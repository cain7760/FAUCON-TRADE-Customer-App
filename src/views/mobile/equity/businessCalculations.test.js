import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePositionMetrics, demoRecords, orderInstruments } from './fixtures.js'
import { decimalProduct, decimalSum, quantityForAmount, truncateDecimal } from './decimalMath.js'
import { averageFillPrice, filledAmount, frozenMargin, outstandingAmount } from './orderCalculations.js'
import { amendmentDraft, amendmentEstimate, amendmentPayload, applyDemoOrderAction, createDemoOrder } from './orderActions.js'
import { demoOrderCash, orderError, orderEstimates, validPov } from './orderModel.js'
import { defaultFilters, detailSections, fillProgress, filterRecords, formatNumber } from './model.js'
import { demoAvailableCash, demoLedgerError, demoLedgerStorageKey, demoPositionRows, demoTradeRows, loadDemoOrders, saveDemoOrders, submitDemoOrder } from './demoLedger.js'
import { orderAccountOverview } from './accountOverview.js'
import { orderTableColumns } from './orderTableColumns.js'
import { orderRowActions, orderStatuses } from './orderStatus.js'

const date = new Date('2026-10-26T02:00:00Z')
const symbol = orderInstruments[0]
const draft = { type: 'limit', price: 11.78, mode: 'quantity', value: 100, unit: 'shares', algorithm: 'DMA' }
const snapshot = (extra = {}) => ({ symbol, account: 'TZS_T0', execution: 'lowTouch', type: 'limit', side: 'buy', price: 11.78, quantity: 100, algorithmCode: 'DMA', inputAmount: null, ...extra })
const freshOrders = () => structuredClone(demoRecords.orders)

test('十进制计算和截断不会损失分、三位报价或整手边界', () => {
  assert.equal(formatNumber(1.13), '1.13')
  assert.equal(formatNumber(-1.139), '-1.13')
  assert.equal(truncateDecimal(1.13e-3, 3), .001)
  assert.equal(decimalSum(.1, .2), .3)
  assert.equal(decimalProduct(11.79, 20000), 235800)
  assert.equal(quantityForAmount(4356, 10.89, 100), 400)
  assert.equal(quantityForAmount(4355.99, 10.89, 100), 300)
  for (const value of [NaN, Infinity, undefined, null, -1]) assert.equal(quantityForAmount(value, 10, 100), 0)
})

test('港股三位报价、原币金额及 CNY 资金换算前后一致', () => {
  const hk = { code: '00700', market: 'HK', currency: 'HKD', price: 1.135, lotSize: 100, iaRate: 25 }
  const d = { ...draft, price: 1.135, value: 1000 }
  const estimate = orderEstimates(d, hk, 1044.2, 1000)
  assert.equal(estimate.maxBuy, 1000)
  assert.equal(estimate.buyAmount, 1135)
  assert.equal(orderError(d, hk, estimate, 'buy'), '')
  const order = createDemoOrder(snapshot({ symbol: hk, price: 1.135, quantity: 1000, amount: 999999 }), 1, date)
  assert.equal(order.estimate, 1135, '不信任过时的预估金额')
  assert.equal(order.frozenMargin, 283.75, '使用标的 IA 而不是写死40%')
  assert.equal(orderError({ ...d, price: 1.1351 }, hk, orderEstimates({ ...d, price: 1.1351 }, hk, 2000, 1000), 'buy'), '订单价格最多保留三位小数')
})

test('无效资金与数量输入不能绕过容量校验，万股小数换算为整数股', () => {
  for (const cash of [undefined, null, NaN, Infinity, -1, 1e308]) {
    const estimate = orderEstimates(draft, symbol, cash, 0)
    assert.equal(estimate.maxBuy, 0)
    assert.match(orderError(draft, symbol, estimate, 'buy'), /超出最大可买/)
  }
  const wan = { ...draft, value: 1.01, unit: 'wan' }
  const estimate = orderEstimates(wan, symbol, demoOrderCash.TZS_T0, 20000)
  assert.equal(estimate.buy, 10100)
  assert.equal(orderError(wan, symbol, estimate, 'buy'), '')
  for (const pov of [{ hours: null, minutes: 1, participation: 10 }, { hours: 1, minutes: null, participation: 10 }, { hours: 0, minutes: 0, participation: 10 }]) assert.equal(validPov(pov), false)
  assert.equal(validPov(null), false); assert.equal(validPov(undefined), false)
})

test('FIFO 用未平批次计算成本和已实现盈亏，A股买入受T+1约束', () => {
  const position = { price: 16, marginRate: 25, openingLots: [{ quantity: 100, price: 10 }, { quantity: 100, price: 12 }], todayExecutions: [{ side: 'buy', quantity: 100, price: 14 }, { side: 'sell', quantity: 150, price: 15 }] }
  const result = calculatePositionMetrics(position, true)
  assert.equal(result.qty, 150)
  assert.equal(result.available, 50)
  assert.equal(result.cost, 2000 / 150)
  assert.equal(result.dailyRealizedProfit, 650)
  assert.equal(result.value, 2400)
  assert.equal(result.floatingProfit, 400)
  assert.equal(result.totalProfit, 1050)
  assert.equal(result.marginOccupied, 500)
  const hk = calculatePositionMetrics({ opening: 100, cost: 1.001, price: 1.009, todayExecutions: [{ side: 'sell', quantity: 100, price: 1.006 }] })
  assert.equal(hk.dailyRealizedProfit, .5)
  assert.equal(hk.qty, 0); assert.equal(hk.value, 0); assert.equal(hk.marginOccupied, 0)
  assert.throws(() => calculatePositionMetrics({ opening: 0, cost: 10, todayExecutions: [{ side: 'buy', quantity: 100, price: 10 }, { side: 'sell', quantity: 100, price: 12 }] }, true), /当日买入不可当日卖出/)
  assert.throws(() => calculatePositionMetrics({ opening: 100, cost: 10, todayExecutions: [{ side: 'sell', quantity: 101, price: 12 }] }), /超过 FIFO/)
  assert.equal(calculatePositionMetrics({ opening: 100, cost: 10 }).value, null, '无行情不能用成本价冒充最新价')
})

test('零数量不进入持仓表格、卡片共享记录，清仓盈亏和委托历史仍存在', () => {
  const rows = [0, '0', null, NaN, 100].map((qty, index) => ({ ...demoRecords.positions[0], id: `p${index}`, qty }))
  assert.deepEqual(filterRecords('positions', rows, defaultFilters(), ['TZS_T0']).map(row => row.id), ['p4'])
  assert.deepEqual(demoPositionRows(freshOrders(), rows).map(row => row.id), ['p4'])
  const closed = calculatePositionMetrics({ opening: 100, cost: 10, price: 12, todayExecutions: [{ side: 'sell', quantity: 100, price: 12 }] }, true)
  assert.equal(closed.qty, 0); assert.equal(closed.available, 0); assert.equal(closed.dailyRealizedProfit, 200)
  assert.equal(filterRecords('orders', freshOrders(), defaultFilters(), ['TZS_T0']).length, 47)
})

test('成交金额优先使用回报，均价取金额除股数，部分成交不提前显示100%', () => {
  const row = { ...demoRecords.orders[3], filledQuantity: 300, filledAmount: 3200.99, filledPrice: 10.66 }
  assert.equal(filledAmount(row), 3200.99)
  assert.equal(averageFillPrice(row), 3200.99 / 300)
  assert.equal(orderTableColumns.find(column => column.key === 'filledAmount').value(row), '3,200.99')
  const fields = detailSections('orders', row, 1).flatMap(section => section.fields)
  assert.equal(fields.find(field => field.key === 'filledAmount').value, '3,200.99')
  assert.equal(fillProgress({ quantity: 10000, filledQuantity: 9999 }), '99.99%')
  assert.equal(fillProgress({ quantity: 100, filledQuantity: NaN }), '--')
})

test('冻结保证金只计算买单未成交部分，卖单、终态、成交部分不冻结', () => {
  const base = { side: 'buy', status: '部成', quantity: 1000, filledQuantity: 400, filledPrice: 9, price: 10, marginRate: 25 }
  assert.equal(outstandingAmount(base), 6000)
  assert.equal(frozenMargin(base), 1500)
  assert.equal(frozenMargin({ ...base, inputAmount: 10000 }), 1600)
  for (const status of ['撤单', '部撤', '全成', '拒单', '未报']) assert.equal(frozenMargin({ ...base, status }), 0)
  assert.equal(frozenMargin({ ...base, side: 'sell' }), 0)
})

test('金额委托撤回未使用预算；数量委托撤回股数不被误当金额', () => {
  const order = { ...createDemoOrder(snapshot({ quantity: 1000, inputAmount: 11780 }), 1, date), status: '部成', filledQuantity: 400, filledAmount: 4600, filledPrice: 11.5 }
  applyDemoOrderAction([order], order.id, 'cancel', {}, date)
  assert.equal(order.canceledQuantity, 600)
  assert.equal(order.canceledAmount, 7180)
  assert.equal(orderTableColumns.find(column => column.key === 'canceledValue').value(order), '7,180.00')
  const quantityOrder = { ...order, inputAmount: null }
  assert.equal(orderTableColumns.find(column => column.key === 'canceledValue').value(quantityOrder), '600')
})

test('部成金额改单不按新价重估已成交金额，剩余预算和零头完整转入子委托', () => {
  const row = { ...createDemoOrder(snapshot({ quantity: 1000, inputAmount: 11780 }), 1, date), status: '部成', filledQuantity: 400, filledAmount: 4600, filledPrice: 11.5 }
  const draft = { ...amendmentDraft(row), price: 12 }
  assert.equal(draft.value, 7180)
  const estimate = amendmentEstimate(draft, row, symbol, 100000)
  assert.equal(estimate.buy, 500)
  const payload = { ...amendmentPayload(draft, row, estimate), referencePrice: 12 }
  assert.equal(payload.inputAmount, 11780)
  const rows = [row]
  applyDemoOrderAction(rows, row.id, 'amend', payload, date)
  assert.equal(row.filledAmount, 4600); assert.equal(row.filledPrice, 11.5)
  assert.equal(row.canceledAmount, 7180)
  assert.equal(rows[1].quantity, 500); assert.equal(rows[1].inputAmount, 7180)
  assert.equal(rows[1].frozenMargin, 2872)
})

test('提交委托立刻进入订单，冻结新增容量，撤单释放且不虚构成交', () => {
  const orders = freshOrders(), holdings = structuredClone(demoRecords.positions)
  const order = submitDemoOrder(orders, snapshot(), date)
  assert.equal(orders[0], order)
  assert.equal(order.status, '待报'); assert.equal(order.filledQuantity, 0); assert.equal(order.reportQuantity, 0)
  assert.equal(order.frozenMargin, 471.2)
  assert.equal(demoAvailableCash(orders, 'TZS_T0'), 944349.41)
  assert.ok(filterRecords('orders', orders, defaultFilters(), ['TZS_T0']).some(row => row.id === order.id))
  applyDemoOrderAction(orders, order.id, 'cancel', {}, date)
  assert.equal(demoAvailableCash(orders, 'TZS_T0'), 945527.41)
  assert.equal(order.canceledQuantity, 100); assert.equal(order.canceledAmount, 1178)
  assert.deepEqual(demoRecords.positions, holdings)
})

test('连续卖出按剩余可用股数校验，未成交卖单不改变持仓数量', () => {
  const orders = freshOrders()
  const order = submitDemoOrder(orders, snapshot({ side: 'sell', quantity: 9300 }), date)
  const row = demoPositionRows(orders).find(row => row.id === 'T0-0')
  assert.equal(row.qty, 9300); assert.equal(row.available, 0)
  assert.equal(order.frozenMargin, 0)
  assert.throws(() => submitDemoOrder(orders, snapshot({ side: 'sell' }), date), /超出最大可卖/)
  applyDemoOrderAction(orders, order.id, 'cancel', {}, date)
  assert.equal(demoPositionRows(orders).find(row => row.id === 'T0-0').available, 9300)
})

test('确认时再次校验资金、账户和参数；失败不追加订单', () => {
  const orders = freshOrders(), length = orders.length
  for (const input of [snapshot({ account: 'TZS_T2' }), snapshot({ quantity: 1000000 }), snapshot({ account: 'UNKNOWN' }), snapshot({ quantity: -100 }), snapshot({ inputAmount: 99999999 })]) assert.throws(() => submitDemoOrder(orders, input, date))
  assert.equal(orders.length, length)
  const order = submitDemoOrder(orders, snapshot(), date)
  order.price = 1000000
  assert.match(demoLedgerError(orders), /超出可用资金/)
})

test('本地委托保存后可恢复，损坏缓存回退；概要余额同步委托占用', () => {
  const memory = new Map(), storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }
  const orders = freshOrders(), order = submitDemoOrder(orders, snapshot(), date)
  assert.equal(saveDemoOrders(storage, orders), true)
  const restored = loadDemoOrders(storage)
  assert.equal(restored[0].id, order.id); assert.equal(restored.length, orders.length)
  const cash = { TZS_T0: demoAvailableCash(restored, 'TZS_T0') }
  assert.equal(orderAccountOverview('TZS_T0', demoPositionRows(restored), cash).available, cash.TZS_T0)
  storage.setItem(demoLedgerStorageKey, '{broken')
  assert.deepEqual(loadDemoOrders(storage), demoRecords.orders)
  assert.equal(saveDemoOrders(null, orders), false)
})

test('每账户每状态至少三个样例，成交与撤单守恒，操作门禁沿用原规则', () => {
  const samples = demoRecords.orders.filter(row => row.demoStatusSample)
  assert.equal(new Set(demoRecords.orders.map(row => row.id)).size, demoRecords.orders.length)
  assert.equal(new Set(demoRecords.orders.map(row => row.orderNo)).size, demoRecords.orders.length)
  for (const account of ['TZS_T0', 'TZS_T1']) {
    for (const status of orderStatuses) assert.equal(samples.filter(row => row.account === account && row.status === status).length, 3)
  }
  for (const row of samples) {
    assert.ok(row.filledQuantity >= 0 && row.filledQuantity <= row.quantity)
    assert.equal(row.filledAmount, truncateDecimal(decimalProduct(row.filledQuantity, row.referencePrice), 2))
    if (row.status === '全成') assert.equal(row.filledQuantity, row.quantity)
    if (['撤单', '部撤'].includes(row.status)) assert.equal(row.filledQuantity + row.canceledQuantity, row.quantity)
    if (row.inputAmount != null) assert.equal(row.canceledAmount, truncateDecimal(decimalProduct(row.canceledQuantity, row.referencePrice), 2))
    const fills = demoRecords.trades.filter(fill => fill.orderNo === row.orderNo)
    assert.equal(fills.reduce((total, fill) => total + fill.filledQuantity, 0), row.filledQuantity)
    const actions = orderRowActions(row)
    assert.ok(actions.every(action => action.disabled === !['待报', '已报', '部成'].includes(row.status)
      || row.status === '异常' && row.orderType === '系统单' && action.key === 'convert'))
  }
})

test('旧缓存补充缺失状态样例，不重置已操作委托或重复追加，不改变初始余额', () => {
  let saved = JSON.stringify({ version: 1, orders: demoRecords.orders.filter(row => !row.demoStatusSample) })
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value } }
  const restored = loadDemoOrders(storage)
  assert.equal(restored.length, demoRecords.orders.length)
  for (const account of ['TZS_T0', 'TZS_T1']) assert.equal(demoAvailableCash(restored, account), demoOrderCash[account])
  const sample = restored.find(row => row.demoStatusSample && row.status === '已报')
  applyDemoOrderAction(restored, sample.id, 'cancel', {}, date)
  saveDemoOrders(storage, restored)
  const again = loadDemoOrders(storage)
  assert.equal(again.length, restored.length)
  assert.equal(again.find(row => row.id === sample.id).status, '撤单')
  assert.deepEqual(again.filter(row => !row.demoStatusSample), restored.filter(row => !row.demoStatusSample))
})

test('旧编号迁移保持订单ID、业务字段、母子单及成交关联，二次加载不再换号', () => {
  const legacy = freshOrders().map(row => ({ ...row, orderNo: `OLD-${row.id}` }))
  const parent = legacy.find(row => row.id === 'seed-4')
  const child = { ...parent, id: 'legacy-user-child', orderNo: 'DEMO-old-child', parentOrderNo: parent.orderNo,
    history: [{ content: `由订单 ${parent.orderNo} 生成` }] }
  legacy.unshift(child)
  let saved = JSON.stringify({ version: 1, orders: legacy })
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value } }
  const migrated = loadDemoOrders(storage)
  assert.equal(migrated.length, legacy.length)
  assert.equal(new Set(migrated.map(row => row.orderNo)).size, migrated.length)
  for (const row of migrated) {
    const before = legacy.find(item => item.id === row.id)
    assert.match(row.orderNo, /^\d{18}$/)
    assert.equal(row.orderNo.slice(7, 15), row.orderTime.slice(0, 10).replaceAll('-', ''))
    for (const key of ['status', 'quantity', 'filledQuantity', 'canceledQuantity', 'account']) assert.equal(row[key], before[key])
  }
  const newParent = migrated.find(row => row.id === parent.id)
  const newChild = migrated.find(row => row.id === child.id)
  assert.equal(newChild.parentOrderNo, newParent.orderNo)
  assert.ok(newChild.history[0].content.includes(newParent.orderNo))
  const fills = demoTradeRows(migrated)
  assert.equal(fills.length, demoRecords.trades.length)
  assert.ok(fills.every(fill => migrated.some(row => row.orderNo === fill.orderNo && fill.entrustNo === row.orderNo)))
  saveDemoOrders(storage, migrated)
  assert.deepEqual(loadDemoOrders(storage), migrated)
})

test('同一时刻连续下单不重号，保存恢复后仍分配未占用编号', () => {
  const rows = freshOrders()
  const first = submitDemoOrder(rows, snapshot(), date)
  const second = submitDemoOrder(rows, snapshot(), date)
  assert.match(first.orderNo, /^1000900\d{11}$/)
  assert.notEqual(first.orderNo, second.orderNo)
  assert.equal(first.orderNo.slice(7, 15), '20261026')
  let saved
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value } }
  saveDemoOrders(storage, rows)
  const restored = loadDemoOrders(storage)
  const third = submitDemoOrder(restored, snapshot(), date)
  assert.notEqual(third.orderNo, first.orderNo)
  assert.notEqual(third.orderNo, second.orderNo)
})
