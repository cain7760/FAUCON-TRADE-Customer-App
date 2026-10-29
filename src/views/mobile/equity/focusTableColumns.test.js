import test from 'node:test'
import assert from 'node:assert/strict'
import { focusCsv, focusDefaultColumnKeys, focusExportData, focusTableColumns, resolveFocusColumns, sortFocusRecords } from './focusTableColumns.js'
import { recordTableColumns } from './recordTableColumns.js'
import { sortTableRecords } from './tableSorting.js'
import { demoRecords } from './fixtures.js'

test('新版持仓列覆盖 PC 可配置字段，独立期初/持仓/可用/市值且旧基线不变', () => {
  assert.deepEqual(focusTableColumns('positions').map(column => column.key), ['code', 'name', 'price', 'opening', 'holdingQty', 'available', 'valueWan', 'marginOccupied', 'marginRate', 'floatingProfit', 'account', 'market', 'currency', 'direction', 'orderRemark', 'traderRemark'])
  assert.ok(recordTableColumns('positions').every(column => !['code', 'opening', 'available'].includes(column.key)))
  assert.equal(focusTableColumns('positions').find(column => column.key === 'valueWan').second, undefined)
  assert.ok(focusDefaultColumnKeys('positions').every(key => !['orderRemark', 'traderRemark'].includes(key)))
})

test('列配置按用户顺序过滤，隐藏列不回填，去重并忽略过期字段', () => {
  assert.deepEqual(resolveFocusColumns('orders', ['status', 'code', 'status', 'missing']).map(column => column.key), ['status', 'code'])
  assert.deepEqual(resolveFocusColumns('positions', []), [])
  assert.deepEqual(resolveFocusColumns('trades', null).map(column => column.key), focusDefaultColumnKeys('trades'))
})

test('新版持仓双行价格按最新价排序，基线仍按均价', () => {
  const rows = [{ id: 'a', cost: 1, price: 9 }, { id: 'b', cost: 2, price: 3 }]
  const column = focusTableColumns('positions').find(column => column.key === 'price')
  assert.deepEqual(sortFocusRecords(rows, 'positions', column, 'ascending').map(row => row.id), ['b', 'a'])
  assert.deepEqual(sortTableRecords(rows, 'positions', column, 'ascending').map(row => row.id), ['a', 'b'])
  assert.deepEqual(rows.map(row => row.id), ['a', 'b'])
})

test('新版订单所有排序方向均异常置顶并保留组内稳定排序', () => {
  const rows = [{ id: 'a', quantity: 100, status: '已报' }, { id: 'b', quantity: 500, status: '异常' }, { id: 'c', quantity: 200, status: '已报' }, { id: 'd', quantity: 400, status: '异常' }]
  const column = focusTableColumns('orders').find(column => column.key === 'orderValueNumber')
  assert.deepEqual(sortFocusRecords(rows, 'orders', column, 'ascending').map(row => row.id), ['d', 'b', 'a', 'c'])
  assert.deepEqual(sortFocusRecords(rows, 'orders', column, 'descending').map(row => row.id), ['b', 'd', 'c', 'a'])
  assert.deepEqual(sortFocusRecords(rows, 'orders', undefined, 'none').map(row => row.id), ['b', 'd', 'a', 'c'])
})

test('CSV 列数和完整字段与 PC 导出一致，数量金额分列，不受表格列选择影响', () => {
  for (const [kind, count] of [['positions', 19], ['orders', 26], ['trades', 19]]) {
    const data = focusExportData(kind, demoRecords[kind].slice(0, 2))
    assert.equal(data.header.length, count)
    assert.equal(data.records.length, 2)
    assert.ok(data.records.every(row => row.length === count))
    assert.ok(data.header.includes('币种'))
  }
  const orders = focusExportData('orders', [{ code: '001', name: '测试', quantity: 100, price: 2, canceledQuantity: 20 }])
  assert.equal(orders.records[0][orders.header.indexOf('订单数量')], '100')
  assert.equal(orders.records[0][orders.header.indexOf('订单金额')], '200.00')
  assert.equal(orders.records[0][orders.header.indexOf('撤单金额')], '40.00')
})

test('CSV 正确转义逗号引号换行与公式文本，并保留负数', () => {
  const csv = focusCsv('positions', [{ ...demoRecords.positions[0], name: '=SUM(A1)', orderRemark: '备注,"原文"\n第二行', floatingProfit: -23.45 }])
  assert.ok(csv.content.startsWith('\ufeff'))
  assert.ok(csv.content.includes('"\'=SUM(A1)"'))
  assert.ok(csv.content.includes('"备注,""原文""\n第二行"'))
  assert.ok(csv.content.includes('"-23.45"'))
})
