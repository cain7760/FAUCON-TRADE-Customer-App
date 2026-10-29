import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneHistoryFilters, defaultHistoryFilters, filterHistoryRecords, historyCell, historyColumns, historyCsv, historyNumber, historyOrderStatuses, historyToday, isHistoryDate, sortHistoryRecords, validateHistoryRange } from './historyModel.js'
import { createHistoryDemo } from './historyFixtures.js'

const today = '2026-10-27'
const demo = createHistoryDemo(today)
const filters = defaultHistoryFilters(today)

test('业务日期使用上海时区，而不是电脑本地日期', () => {
  assert.equal(historyToday(new Date('2026-10-26T16:01:00Z')), today)
  assert.equal(historyToday(new Date('2026-10-26T15:59:00Z')), '2026-10-26')
})
test('默认近 30 天包含今天，支持跨月和闰日，排除未来', () => {
  assert.deepEqual(filters.range, ['2026-09-28', '2026-10-27'])
  assert.equal(validateHistoryRange(['2024-02-29', '2024-02-29'], today), '')
  assert.equal(isHistoryDate('2026-02-29'), false)
  assert.equal(validateHistoryRange(['2026-10-27', '2026-10-27'], today), '')
  assert.match(validateHistoryRange(['2026-10-28', '2026-10-29'], today), /不能晚于今天/)
  assert.match(validateHistoryRange(['2026-10-26', '2026-10-01'], today), /晚于/)
  for (const range of [null, [], ['', ''], ['bad', 'date']]) assert.ok(validateHistoryRange(range, today))
})
test('历史委托保留全部 11 种状态，包含今日，过滤未来及非法日期', () => {
  const current = historyOrderStatuses.map(status => ({ ...demo.orders[0], status, orderDate: today }))
  const rows = filterHistoryRecords('orders', [...demo.orders, ...current, ...['2026-10-28', 'bad'].map(orderDate => ({ ...demo.orders[0], orderDate }))], filters, today)
  assert.deepEqual(new Set(rows.map(row => row.status)), new Set(historyOrderStatuses))
  assert.ok(rows.every(row => row.orderDate <= today))
  assert.ok(rows.some(row => row.orderDate === today))
  assert.ok(rows.some(row => row.filledQuantity === 0))
})
test('历史成交包含部成、部撤的真实成交，排除零成交、负数、缺失编号', () => {
  const invalid = [0, -1, NaN].map(filledQuantity => ({ ...demo.trades[0], filledQuantity }))
  const rows = filterHistoryRecords('trades', [...demo.trades, ...invalid, { ...demo.trades[0], tradeNo: '' }, { ...demo.trades[0], tradeDate: today }], filters, today)
  assert.equal(rows.length, filterHistoryRecords('trades', demo.trades, filters, today).length + 1)
  assert.ok(rows.some(row => row.status === '部撤'))
  assert.ok(rows.every(row => row.filledQuantity > 0 && row.tradeDate <= today && row.tradeNo))
})
test('往日委托按收盘规则归档为终态，挂单与冻结均释放', () => {
  assert.ok(demo.orders.every(row => ['全成', '撤单', '部撤', '拒单'].includes(row.status)))
  assert.ok(demo.orders.every(row => row.reportQuantity === 0 && row.frozenMargin === 0))
})
test('订单与逐笔成交一对多，数量金额一致且成交编号唯一', () => {
  assert.equal(new Set(demo.trades.map(row => row.tradeNo)).size, demo.trades.length)
  for (const order of demo.orders) {
    const fills = demo.trades.filter(row => row.orderNo === order.orderNo)
    assert.equal(fills.reduce((sum, row) => sum + row.filledQuantity, 0), order.filledQuantity)
    assert.equal(Math.round(fills.reduce((sum, row) => sum + row.filledAmount, 0) * 100), Math.round(order.filledAmount * 100))
    if (order.filledQuantity) assert.equal(fills.length, 2)
  }
})
test('日期双端包含，代码名称、编号、账户、方向、开平、类型及多选状态组合生效', () => {
  const target = demo.orders.find(row => row.status === '部撤')
  const query = { ...cloneHistoryFilters(filters), range: [target.orderDate, target.orderDate], symbol: target.code, orderNo: target.orderNo, account: target.account, side: target.side, openClose: target.openClose, orderType: target.orderType, status: ['部撤', '全成'] }
  assert.deepEqual(filterHistoryRecords('orders', demo.orders, query, today).map(row => row.id), [target.id])
  assert.equal(filterHistoryRecords('orders', demo.orders, { ...query, symbol: target.name }, today).length, 1)
  assert.equal(filterHistoryRecords('orders', demo.orders, { ...query, status: ['拒单'] }, today).length, 0)
  const fill = demo.trades.find(row => row.orderNo === target.orderNo)
  assert.equal(filterHistoryRecords('trades', demo.trades, { ...query, tradeNo: fill.tradeNo }, today).length, 1)
  assert.equal(filterHistoryRecords('orders', demo.orders, { ...query, orderNo: '不存在的编号' }, today).length, 0)
})
test('历史委托和历史成交均移除订单类型筛选，旧条件不再隐藏记录', () => {
  const base = { ...demo.orders[0], orderDate: today, tradeDate: today, filledQuantity: 100, tradeNo: 'CJ1' }
  const rows = [{ ...base, id: 'system', orderType: '系统单' }, { ...base, id: 'manual', tradeNo: 'CJ2', orderType: '手工单' }]
  const query = { ...cloneHistoryFilters(filters), orderType: '系统单' }
  assert.deepEqual(filterHistoryRecords('orders', rows, query, today).map(row => row.id), ['system', 'manual'])
  assert.deepEqual(filterHistoryRecords('trades', rows, query, today).map(row => row.id), ['system', 'manual'])
})
test('查询快照不受未提交的多选状态及日期修改影响', () => {
  const draft = defaultHistoryFilters(today), applied = cloneHistoryFilters(draft)
  draft.range[0] = '2020-01-01'; draft.status.push('拒单')
  assert.deepEqual(applied.range, filters.range)
  assert.deepEqual(applied.status, [])
})
test('数量列仅含数值，订单数量/金额及货币单位保留，金额价格仍截断', () => {
  assert.equal(historyNumber(1.13), '1.13')
  assert.equal(historyNumber(12345.6789), '12,345.67')
  assert.equal(historyNumber(-1.239), '-1.23')
  assert.equal(historyNumber(1e-7), '0.00')
  assert.equal(historyNumber(null), '--')
  assert.equal(historyCell({ price: 123.4567, market: 'HK' }, 'price'), '123.456')
  assert.equal(historyCell({ price: 11.789, market: 'SZ' }, 'price'), '11.78')
  assert.equal(historyCell({ price: null, market: 'HK' }, 'price'), '--')
  assert.equal(historyCell({ inputAmount: 1917, currency: 'CNY' }, 'orderValue'), '1,917.00 元')
  assert.equal(historyCell({ inputAmount: 1917, currency: 'HKD' }, 'orderValue'), '1,917.00 港元')
  assert.equal(historyCell({ quantity: 2000, inputAmount: null }, 'orderValue'), '2,000 股')
  assert.equal(historyCell({ filledQuantity: 1234.5678 }, 'filledQuantity'), '1,234.567')
  assert.equal(historyCell({ reportQuantity: 3000 }, 'reportQuantity'), '3,000')
  assert.equal(historyCell({ canceledValue: 1200, inputAmount: null }, 'canceledValue'), '1,200')
  assert.equal(historyCell({ canceledValue: 1917, inputAmount: 1917, currency: 'HKD' }, 'canceledValue'), '1,917.00 港元')
})
test('排序稳定、数值排序不按字符串，源记录不变', () => {
  const input = [{ ...demo.orders[0], id: 'a', quantity: 2, inputAmount: null, type: 'limit' }, { ...demo.orders[0], id: 'b', quantity: 10, inputAmount: null, type: 'market' }, { ...demo.orders[0], id: 'c', quantity: 1, inputAmount: 1000, type: 'limit' }]
  const before = structuredClone(input)
  for (const key of ['quantity', 'orderValueNumber', 'orderValue']) {
    assert.deepEqual(sortHistoryRecords('orders', input, { key, direction: 'ascending' }).map(row => row.id), ['a', 'b', 'c'])
    assert.deepEqual(sortHistoryRecords('orders', input, { key, direction: 'descending' }).map(row => row.id), ['c', 'b', 'a'])
  }
  assert.equal(sortHistoryRecords('orders', input, { key: 'attribute', direction: 'ascending' })[0].type, 'market')
  assert.equal(sortHistoryRecords('orders', input, { key: 'attribute', direction: 'descending' }).at(-1).type, 'market')
  assert.deepEqual(input, before)
  const rows = sortHistoryRecords('orders', filterHistoryRecords('orders', demo.orders, filters, today))
  assert.ok(rows[0].orderDate >= rows.at(-1).orderDate)
})
test('导出所有匹配记录而非当前页，字段完整，逐笔价格不冒充成交均价', () => {
  const rows = filterHistoryRecords('orders', demo.orders, filters, today)
  const csv = historyCsv('orders', rows, filters.range)
  assert.ok(rows.length > 20)
  assert.equal(csv.count, rows.length)
  assert.ok(csv.content.startsWith('\ufeff"委托日期"'))
  assert.equal(csv.content.split('\r\n').length, rows.length + 1)
  assert.ok(csv.filename.includes('2026-09-28_2026-10-27'))
  assert.ok(!historyColumns.orders.some(column => column.key === 'operation'))
  assert.equal(historyColumns.orders.at(-1).key, 'reportQuantity')
  assert.ok(historyColumns.trades.some(column => column.label === '成交价格'))
  assert.ok(!historyColumns.trades.some(column => column.label === '成交均价'))
})
test('CSV 防公式注入，正确转义逗号、换行、双引号', () => {
  const csv = historyCsv('orders', [{ ...demo.orders[0], name: '=SUM(A1)', orderRemark: '说明,"原文"\n第二行' }], filters.range)
  assert.ok(csv.content.includes('"\'=SUM(A1)"'))
  assert.ok(csv.content.includes('"说明,""原文""\n第二行"'))
})
