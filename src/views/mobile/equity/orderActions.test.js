import test from 'node:test'
import assert from 'node:assert/strict'
import { amendmentDraft, amendmentError, amendmentEstimate, amendmentPayload, applyDemoOrderAction, canConvertOrder, createDemoOrder, orderActionReason } from './orderActions.js'
import { orderTableColumns } from './orderTableColumns.js'
import { orderStatusVisual } from './orderStatus.js'

const symbol = { name: '平安银行', code: '000001', market: 'SZ', price: 12, lotSize: 100 }
const order = (extra = {}) => ({ ...symbol, id: 'one', orderNo: 'WT1', account: 'TZS_T0', orderType: '系统单', status: '已报', side: 'buy', openClose: '开', type: 'limit', price: 12, quantity: 1000, filledQuantity: 0, filledPrice: null, inputAmount: null, reportQuantity: 1000, frozenMargin: 4800, marginRate: 40, algorithm: 'DMA', orderRemark: '', ...extra })
const date = new Date('2026-10-20T02:00:00Z')
test('港股市价新单及改单提交均被拒绝，且拒绝后不修改订单', () => {
  const hk = { ...symbol, market: 'HK', code: '00700', currency: 'HKD', price: 320 }
  const snapshot = { symbol: hk, account: 'TZS_T0', side: 'buy', algorithmCode: 'DMA', execution: 'lowTouch', type: 'market', price: 320, quantity: 100, amount: 32000 }
  assert.throws(() => createDemoOrder(snapshot, 20, date), /港股仅支持限价/)
  const placed = createDemoOrder({ ...snapshot, type: 'limit' }, 21, date)
  assert.equal(placed.currency, 'HKD'); assert.equal(placed.market, 'HK')
  const row = order({ ...hk, price: 320, quantity: 100 })
  const before = structuredClone(row)
  assert.throws(() => applyDemoOrderAction([row], row.id, 'amend', { type: 'market', quantity: 100, referencePrice: 320 }, date), /港股仅支持限价/)
  assert.deepEqual(row, before)
  assert.equal(amendmentDraft({ ...row, type: 'market', price: null }).type, 'limit')
})
test('confirmed local order preserves Customer parameters without inventing fills', () => {
  const snapshot = { symbol, account: 'TZS_T0', execution: 'highTouch', type: 'limit', side: 'sell',
    openClose: '平', quantity: 300, price: 12, amount: 3600, inputAmount: null,
    algorithmCode: 'POV', pov: { hours: 1, minutes: 5, participation: 10 }, note: '分批执行' }
  const row = createDemoOrder(snapshot, 16, date)
  assert.equal(row.status, '待报'); assert.equal(row.filledQuantity, 0); assert.equal(row.filledPrice, null)
  assert.equal(row.reportQuantity, 0); assert.equal(row.orderRemark, '分批执行')
  assert.equal(row.openClose, '平'); assert.equal(row.orderType, '手工单')
  assert.equal(row.algorithm, 'POV'); assert.deepEqual(row.algorithmParams, snapshot.pov)
  assert.equal(row.frozenMargin, 0)
  const market = createDemoOrder({ ...snapshot, type: 'market', price: 0, amount: 0, algorithmCode: 'none' }, 17, date)
  assert.equal(market.price, null); assert.equal(market.algorithmParams, null)
  assert.notEqual(market.orderNo, row.orderNo)
})
function amendment(row, changes = {}) {
  const draft = { ...amendmentDraft(row), ...changes }
  const estimate = amendmentEstimate(draft, row, symbol, 100000)
  return { draft, estimate, payload: { ...amendmentPayload(draft, row, estimate), referencePrice: estimate.price } }
}
test('操作结果、订单动态和历史不附加演示说明，原有状态变更保留', () => {
  const created = createDemoOrder({ symbol, account: 'TZS_T0', side: 'buy', type: 'limit', price: 12, quantity: 100, amount: 1200, algorithmCode: 'DMA' }, 1, date)
  const canceled = order(), converted = order({ status: '异常' }), amended = order({ filledQuantity: 400 })
  const rows = [amended]
  const messages = [created.feedback,
    applyDemoOrderAction([canceled], canceled.id, 'cancel', {}, date),
    applyDemoOrderAction([converted], converted.id, 'convert', {}, date),
    applyDemoOrderAction(rows, amended.id, 'amend', amendment(amended, { value: 500, price: 12.1 }).payload, date)]
  for (const row of [canceled, converted, ...rows]) messages.push(row.feedback, ...(row.history || []).map(item => item.message))
  for (const message of messages) assert.doesNotMatch(message, /模拟|演示|本地|真实委托/)
  assert.equal(canceled.status, '撤单'); assert.equal(converted.orderType, '手工单')
  assert.equal(amended.filledQuantity, 400); assert.equal(rows[1].quantity, 500)
})
test('all Customer order business fields remain independent', () => {
  assert.deepEqual(orderTableColumns.map(column => column.key), ['index', 'code', 'name', 'status', 'fillProgress', 'attribute', 'price', 'orderValueNumber', 'filledQuantity', 'filledPrice', 'side', 'filledAmount', 'canceledValue', 'frozenMargin', 'marginRate', 'orderNo', 'orderTime', 'account', 'market', 'currency', 'orderType', 'algorithm', 'orderRemark', 'feedback', 'openClose', 'reportQuantity'])
  assert.equal(orderTableColumns.some(column => column.second || column.secondTitle), false)
  for (const column of orderTableColumns) assert.notEqual(column.value(order(), 0), undefined)
  assert.equal(orderTableColumns.find(column => column.key === 'price').value(order({ price: null })), '--')
  assert.equal(orderTableColumns[0].value(order(), 3), 4)
  assert.deepEqual(orderTableColumns.filter(column => column.readable).map(column => column.key), ['status', 'attribute', 'side'])
  assert.equal(orderStatusVisual('拒单').tone, 'rejected')
  assert.equal(orderStatusVisual('全成').tone, 'success')
})
test('Customer permissions enable only outstanding 待报/已报/部成 orders', () => {
  for (const status of ['待报', '已报', '部成']) assert.equal(orderActionReason(order({ status })), '')
  for (const status of ['未报', '待改', '待撤', '部撤', '撤单', '全成', '拒单', '异常']) assert.ok(orderActionReason(order({ status })))
  assert.ok(orderActionReason(order({ filledQuantity: 1000 })))
  assert.equal(canConvertOrder(order({ status: '异常' })), true)
  assert.equal(canConvertOrder(order({ status: '拒单' })), false)
  assert.equal(canConvertOrder(order({ status: '异常', orderType: '手工单' })), false)
  assert.equal(canConvertOrder(order({ status: '异常' }), false), false)
  assert.equal(canConvertOrder(order()), false)
})
test('cancel affects outstanding only; terminal orders reject repeated confirmation', () => {
  const row = order({ status: '部成', filledQuantity: 400, filledPrice: 11.9 })
  applyDemoOrderAction([row], row.id, 'cancel', {}, date)
  assert.equal(row.status, '部撤'); assert.equal(row.canceledQuantity, 600)
  assert.equal(row.quantity, 1000); assert.equal(row.filledQuantity, 400); assert.equal(row.filledPrice, 11.9)
  assert.equal(row.reportQuantity, 0); assert.equal(row.frozenMargin, 0)
  assert.equal(row.history.length, 1)
  assert.throws(() => applyDemoOrderAction([row], row.id, 'cancel'), /状态已变化/)
})
test('conversion preserves exceptional order identity, status and values', () => {
  const row = order({ status: '异常', feedback: '通道回报超时' })
  applyDemoOrderAction([row], row.id, 'convert', { note: '  交由交易员  ' }, date)
  assert.equal(row.id, 'one'); assert.equal(row.orderNo, 'WT1'); assert.equal(row.status, '异常')
  assert.equal(row.quantity, 1000); assert.equal(row.price, 12); assert.equal(row.orderType, '手工单')
  assert.equal(row.orderRemark, '交由交易员'); assert.equal(canConvertOrder(row), false)
  assert.match(row.feedback, /通道回报超时/)
})
test('amend initializes and validates unfilled quantities and limits', () => {
  const row = order({ status: '部成', filledQuantity: 400, side: 'sell' })
  assert.equal(amendmentDraft(row).value, 600)
  let next = amendment(row)
  assert.match(amendmentError(next.draft, row, symbol, next.estimate), /先修改/)
  next = amendment(row, { value: 700 })
  assert.match(amendmentError(next.draft, row, symbol, next.estimate), /最大可卖/)
  next = amendment(row, { value: 300, price: 12.01 })
  assert.equal(amendmentError(next.draft, row, symbol, next.estimate), '')
  assert.equal(next.payload.quantity, 700)
  for (const changes of [{ value: 99 }, { price: 12.001 }, { algorithm: 'POV', pov: { hours: 0, minutes: 0, participation: 30 } }]) {
    next = amendment(row, changes)
    assert.ok(amendmentError(next.draft, row, symbol, next.estimate))
  }
  next = amendment(row, { value: '' })
  assert.match(amendmentError(next.draft, row, symbol, next.estimate), /请输入/)
})
test('part-filled amendment replaces unfilled portion without changing fills', () => {
  const row = order({ status: '部成', filledQuantity: 400, filledPrice: 11.9 })
  const orders = [row], next = amendment(row, { value: 500, price: 12.1 })
  applyDemoOrderAction(orders, row.id, 'amend', next.payload, date)
  assert.equal(row.status, '部撤'); assert.equal(row.quantity, 1000); assert.equal(row.filledQuantity, 400)
  assert.equal(row.filledPrice, 11.9); assert.equal(row.price, 12); assert.equal(row.canceledQuantity, 600)
  assert.equal(orders[1].quantity, 500); assert.equal(orders[1].filledQuantity, 0)
  assert.equal(orders[1].price, 12.1); assert.equal(orders[1].parentOrderNo, 'WT1'); assert.equal(orders[1].status, '待报')
})
test('zero outstanding amendment cancels remainder without a replacement', () => {
  const row = order({ status: '部成', filledQuantity: 400 }), orders = [row]
  const next = amendment(row, { value: 0 })
  assert.equal(amendmentError(next.draft, row, symbol, next.estimate), '')
  applyDemoOrderAction(orders, row.id, 'amend', next.payload, date)
  assert.equal(orders.length, 1); assert.equal(row.status, '部撤')
})
test('unfilled amendment quantity increases create child, reductions update original', () => {
  for (const value of [1200, 800, 1000]) {
    const row = order(), orders = [row], next = amendment(row, { value, price: 12.1 })
    applyDemoOrderAction(orders, row.id, 'amend', next.payload, date)
    assert.equal(row.status, '待改'); assert.equal(row.price, 12.1)
    assert.equal(row.quantity, Math.min(value, 1000)); assert.equal(row.filledQuantity, 0)
    if (value > 1000) { assert.equal(orders[1].quantity, 200); assert.equal(orders[1].parentOrderNo, 'WT1') }
    else assert.equal(orders.length, 1)
    if (value < 1000) assert.equal(row.canceledQuantity, 200)
  }
})
test('amount and percentage amendment use the original side and preserve total semantics', () => {
  const row = order({ status: '部成', filledQuantity: 400, inputAmount: 12000 })
  assert.equal(amendmentDraft(row).value, 7200)
  const next = amendment(row, { mode: 'amount', value: 3600 })
  assert.equal(next.payload.quantity, 700); assert.equal(next.payload.inputAmount, 8400)
  const sell = order({ side: 'sell', filledQuantity: 400 })
  const percentage = amendment(sell, { mode: 'percentage', fraction: 50 })
  assert.equal(percentage.estimate.sell, 300); assert.equal(percentage.payload.quantity, 700)
})
test('invalid or stale amendment confirmations leave records unchanged', () => {
  for (const change of [{ quantity: -100 }, { quantity: 99 }, { price: 0 }, { type: 'unknown' }, { algorithm: 'POV', algorithmParams: null }]) {
    const row = order(), before = JSON.stringify(row), next = amendment(row, { price: 12.1 })
    assert.throws(() => applyDemoOrderAction([row], row.id, 'amend', { ...next.payload, ...change }, date))
    assert.equal(JSON.stringify(row), before)
  }
  const row = order({ side: 'sell' }), next = amendment(row, { value: 1200 })
  assert.throws(() => applyDemoOrderAction([row], row.id, 'amend', next.payload), /最大可卖/)
  row.status = '全成'
  assert.throws(() => applyDemoOrderAction([row], row.id, 'amend', amendment(row).payload), /状态已变化/)
})
