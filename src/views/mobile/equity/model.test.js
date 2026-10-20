import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePositionMetrics, demoRecords, orderStatuses } from './fixtures.js'
import { accountLabel, activeFilterLabels, advancedFilterCount, defaultFilters, detailSections, filterRecords, filterCount, fillProgress, formatNumber, orderPrice, orderQuantity, pnlClass } from './model.js'

test('成交进度覆盖零、部分、全成和不可计算状态，比例限制在 0–100%', () => {
  assert.equal(fillProgress({ quantity: 1000, filledQuantity: 0 }), '0%')
  assert.equal(fillProgress({ quantity: 1000, filledQuantity: 400 }), '40%')
  assert.equal(fillProgress({ quantity: 300, filledQuantity: 100 }), '33%')
  assert.equal(fillProgress({ quantity: 1000, filledQuantity: 1000 }), '100%')
  assert.equal(fillProgress({ quantity: 1000, filledQuantity: 1500 }), '100%')
  assert.equal(fillProgress({ quantity: 1000, filledQuantity: -1 }), '0%')
  assert.equal(fillProgress({ quantity: 0, filledQuantity: 0 }), '--')
})

test('账户全称同时保留编号与名称', () => {
  assert.equal(accountLabel('TZS_T0'), 'TZS_T0 - 自营一号')
  assert.equal(accountLabel('TZS_T1'), 'TZS_T1 - 自营二号')
  assert.equal(accountLabel('UNKNOWN'), '--')
})

test('Customer 默认账户 12 / 14 / 3，全部账户 24 / 16 / 4', () => {
  const counts = accountIds => Object.entries(demoRecords).map(([kind, rows]) => filterRecords(kind, rows, defaultFilters(), accountIds).length)
  assert.deepEqual(counts(['TZS_T0']), [12, 14, 3])
  assert.deepEqual(counts(['TZS_T0', 'TZS_T1']), [24, 16, 4])
  assert.deepEqual(counts(['TZS_T1']), [12, 2, 1])
})
test('持仓字段按日初、当日成交、在途卖出及 FIFO 计算，第二账户保持相同口径', () => {
  const firstAccount = demoRecords.positions.filter(row => row.account === 'TZS_T0')
  for (const row of firstAccount) {
    const buys = (row.todayExecutions || []).filter(item => item.side === 'buy').reduce((total, item) => total + item.quantity, 0)
    const sells = (row.todayExecutions || []).filter(item => item.side === 'sell').reduce((total, item) => total + item.quantity, 0)
    assert.equal(row.qty, row.opening + buys - sells)
    assert.equal(row.available, row.qty - (row.pendingSell || 0) - buys)
    assert.equal(row.value, Math.round(row.price * 100) * row.qty / 100)
    assert.equal(row.marginOccupied, row.qty * Math.round(row.cost * 100) * row.marginRate / 10000)
    assert.equal(row.totalProfit, row.floatingProfit + row.dailyRealizedProfit)
    const second = demoRecords.positions.find(item => item.account === 'TZS_T1' && item.code === row.code)
    for (const key of ['opening', 'qty', 'available', 'value', 'marginOccupied', 'floatingProfit', 'dailyRealizedProfit', 'totalProfit']) {
      assert.equal(second[key], row[key] * 2, `${row.code} ${key}`)
    }
  }
  assert.equal(firstAccount.find(row => row.code === '002459').dailyRealizedProfit, -360)
  assert.deepEqual(calculatePositionMetrics({ openingLots: [{ quantity: 100, price: 10 }, { quantity: 100, price: 12 }], todayExecutions: [{ side: 'sell', quantity: 150, price: 15 }] }), { opening: 200, qty: 50, available: 50, dailyRealizedProfit: 650 })
})
test('持仓保留名称/代码与多空筛选，不再按市场过滤', () => {
  const rows = filters => filterRecords('positions', demoRecords.positions, { ...defaultFilters(), ...filters }, ['TZS_T0'])
  assert.equal(rows({ symbol: ' 平安 ' })[0].code, '000001')
  assert.equal(rows({ symbol: '000001.sz' }).length, 1)
  // 兼容旧筛选状态：市场条件不再生效，沪深持仓都可见。
  assert.equal(rows({ market: 'SH' }).length, 12)
  assert.equal(Object.hasOwn(defaultFilters(), 'market'), false)
  assert.equal(rows({ direction: '空' }).length, 0)
  assert.equal(rows({ symbol: '不存在' }).length, 0)
})
test('演示持仓仅保留做多数据，多空方向统一使用做多/做空文案', () => {
  assert.ok(demoRecords.positions.length > 0)
  assert.ok(demoRecords.positions.every(row => row.direction === '多'))
  for (const [direction, label] of [['多', '做多'], ['空', '做空']]) {
    const row = { ...demoRecords.positions[0], direction }
    const fields = detailSections('positions', row, 1).flatMap(section => section.fields)
    assert.equal(fields.find(field => field.key === 'direction').value, label)
    assert.deepEqual(activeFilterLabels('positions', { ...defaultFilters(), direction }), [`多空方向：${label}`])
  }
})
test('订单组合筛选、状态多选和被拒绝系统单优先', () => {
  const rows = filters => filterRecords('orders', demoRecords.orders, { ...defaultFilters(), ...filters }, ['TZS_T0'])
  assert.equal(rows({})[0].orderNo, 'WT20260911008')
  assert.equal(rows({ orderNo: '11004', symbol: '深华发', side: 'sell', openClose: '开', orderType: '手工单', status: ['部成'] }).length, 1)
  assert.equal(rows({ status: ['部成', '全成'] }).length, 3)
  assert.equal(filterCount('orders', { ...defaultFilters(), status: ['全成', '部成'] }), 1)
})
test('所有订单状态按三端约定保留原文、顺序与重复项', () => {
  assert.deepEqual(orderStatuses, ['未报', '待报', '已报', '待撤', '待撤［部成］', '部撒', '撤单', '部成', '全成', '被拒绝', '已报待改', '待改［部成］', '待确认', '审核中', '审核拒绝', '待改审核', '待改［部成］', '待改［未报］', '待确认［待审核］'])
  assert.ok(demoRecords.orders.every(order => orderStatuses.includes(order.status)))
  assert.equal(demoRecords.orders.filter(order => order.inputAmount !== null).length, 4)
  assert.equal(orderQuantity(demoRecords.orders[2]), '1,917.00 元')
})
test('搜索词不计入高级筛选角标，已应用条件按当前列表展示', () => {
  const positions = { ...defaultFilters(), symbol: ' 平安 ', market: 'SH', direction: '多' }
  assert.equal(filterCount('positions', positions), 2)
  assert.equal(advancedFilterCount('positions', positions), 1)
  assert.deepEqual(activeFilterLabels('positions', positions), ['标的：平安', '多空方向：做多'])
  const orders = { ...defaultFilters(), orderNo: 'WT001', status: ['已报', '部成'] }
  assert.equal(advancedFilterCount('orders', orders), 2)
  assert.deepEqual(activeFilterLabels('orders', orders), ['订单编号：WT001', '订单状态：已报、部成'])
})
test('成交条件与订单各自独立，包含系统和交易员反馈', () => {
  const rows = filterRecords('trades', demoRecords.trades, { ...defaultFilters(), side: 'sell', openClose: '开', orderType: '手工单' }, ['TZS_T0'])
  assert.equal(rows.length, 1)
  const activity = detailSections('trades', rows[0], 1).flatMap(section => section.fields).find(field => field.key === 'feedback')
  assert.match(activity.value, /系统：.*交易员：/)
})
test('截断、千分位、空值、市价和零盈亏显示', () => {
  assert.equal(formatNumber(1234.567), '1,234.56')
  assert.equal(formatNumber(-12.349), '-12.34')
  assert.equal(formatNumber(1234.5678, 3, false), '1,234.567')
  assert.equal(formatNumber(null), '--')
  assert.equal(formatNumber(-.001), '0.00')
  assert.equal(orderPrice({ type: 'market', price: null }), '市价')
  assert.equal(orderQuantity({ inputAmount: 1500.999 }), '1,500.99 元')
  assert.equal(pnlClass(0), '')
})
test('详情覆盖完整数据字段，只为记录编号提供复制', () => {
  const expectedCounts = { positions: 19, orders: 26, trades: 20 }
  for (const kind of Object.keys(demoRecords)) {
    for (const row of demoRecords[kind]) {
      const fields = detailSections(kind, row, 1).flatMap(section => section.fields)
      assert.equal(fields.length, expectedCounts[kind])
      assert.equal(new Set(fields.map(field => field.key)).size, fields.length)
      for (const field of fields) {
        assert.notEqual(field.value, undefined)
        if (field.copyable) assert.ok(['orderNo', 'tradeNo', 'entrustNo'].includes(field.key))
      }
    }
  }
})
test('持仓不展示来源订单类型，订单与成交保留订单类型', () => {
  for (const row of demoRecords.positions) {
    const fields = detailSections('positions', row, 1).flatMap(section => section.fields)
    assert.equal(fields.some(field => ['sourceOrderTypes', 'orderType'].includes(field.key)), false)
  }
  for (const kind of ['orders', 'trades']) {
    for (const row of demoRecords[kind]) {
      const fields = detailSections(kind, row, 1).flatMap(section => section.fields)
      assert.equal(fields.find(field => field.key === 'orderType').value, row.orderType)
    }
  }
})
test('详情标记数值字体，中文字段保留原字体', () => {
  for (const kind of Object.keys(demoRecords)) {
    const fields = detailSections(kind, demoRecords[kind][0], 1).flatMap(section => section.fields)
    for (const key of ['name', 'currency', 'account', 'orderRemark']) assert.equal(fields.find(field => field.key === key).numeric, false)
    for (const key of ['price', 'qty', 'value', 'filledQuantity', 'filledAmount', 'marginRate']) {
      const field = fields.find(field => field.key === key)
      if (field) assert.equal(field.numeric, true)
    }
  }
})
