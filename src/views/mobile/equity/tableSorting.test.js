import test from 'node:test'
import assert from 'node:assert/strict'
import { demoRecords } from './fixtures.js'
import { recordTableColumns } from './recordTableColumns.js'
import { nextTableSort, sortTableRecords, tableSortValue } from './tableSorting.js'

const ids = rows => rows.map(row => row.id)
const column = (kind, key) => recordTableColumns(kind).find(item => item.key === key)
test('持仓表移除序号和期初数量，保留后续列顺序及成交序号', () => {
  const positions = recordTableColumns('positions')
  assert.ok(positions.every(item => !['index', 'opening'].includes(item.key)))
  assert.deepEqual(positions.slice(0, 4).map(item => item.key), ['price', 'floatingProfit', 'holdingQty', 'valueWan'])
  assert.ok(recordTableColumns('trades').some(item => item.key === 'index'))
})
test('市值与可用数量共用双行列，浮动盈亏位于含标的的第三列', () => {
  const positions = recordTableColumns('positions')
  assert.equal(positions.findIndex(item => item.key === 'floatingProfit') + 2, 3)
  assert.ok(!positions.some(item => item.key === 'available'))
  const combined = column('positions', 'valueWan')
  assert.equal(combined.title, '市值')
  assert.equal(combined.secondTitle, '可用数量')
  assert.equal(combined.value({ value: 1234567890 }), '1,234,567,890.00')
  assert.equal(combined.second({ available: 9300.125 }), '9,300.125')
  assert.equal(combined.second({ available: 0 }), '0')
  assert.equal(combined.second({}), '--')
  assert.equal(combined.secondTone(), 'equity-accent')
  const rows = [{ id: 'high', value: 1000, available: 1 }, { id: 'low', value: 2, available: 10000 }]
  assert.deepEqual(ids(sortTableRecords(rows, 'positions', combined, 'ascending')), ['low', 'high'])
  assert.deepEqual(ids(sortTableRecords(rows, 'positions', combined, 'descending')), ['high', 'low'])
})
test('基线持仓数量与可用数量双行显示，市值独立且仍按各自主值排序', () => {
  const positions = recordTableColumns('positions', 'baseline')
  const quantity = positions.find(item => item.key === 'holdingQty')
  const value = positions.find(item => item.key === 'valueWan')
  assert.equal(quantity.secondTitle, '可用数量')
  assert.equal(quantity.value({ qty: 12500 }), '12,500')
  assert.equal(quantity.second({ available: 10000.125 }), '10,000.125')
  assert.equal(quantity.second({ available: 0 }), '0')
  assert.equal(quantity.second({}), '--')
  assert.equal(quantity.secondTone(), 'equity-accent')
  assert.equal(value.value({ value: 86500 }), '86,500.00')
  assert.equal(value.secondTitle, undefined)
  assert.equal(value.second, undefined)
  const rows = [{ id: 'high', qty: 1000, available: 1, value: 2 }, { id: 'low', qty: 2, available: 10000, value: 1000 }]
  assert.deepEqual(ids(sortTableRecords(rows, 'positions', quantity, 'ascending')), ['low', 'high'])
  assert.deepEqual(ids(sortTableRecords(rows, 'positions', value, 'ascending')), ['high', 'low'])
  assert.equal(recordTableColumns('positions', 'c').find(item => item.key === 'valueWan').secondTitle, '可用数量')
})
test('基线持仓前五列不变，后续按 Customer Web 默认字段补期初数量并排除备注', () => {
  const columns = recordTableColumns('positions', 'baseline')
  assert.deepEqual(columns.slice(0, 4).map(column => column.key), ['price', 'floatingProfit', 'holdingQty', 'valueWan'])
  assert.deepEqual(columns.slice(4).map(column => column.key), ['opening', 'marginOccupied', 'marginRate', 'account', 'market', 'currency', 'direction'])
  const opening = columns.find(column => column.key === 'opening')
  assert.equal(opening.value({ opening: 9300.125 }), '9,300.125')
  assert.equal(opening.value({}), '0')
  const rows = [{ id: 'large', opening: 10000 }, { id: 'small', opening: 2 }, { id: 'empty' }]
  assert.deepEqual(ids(sortTableRecords(rows, 'positions', opening, 'ascending')), ['empty', 'small', 'large'])
  for (const design of ['default', 'c']) {
    const keys = recordTableColumns('positions', design).map(column => column.key)
    assert.ok(keys.includes('orderRemark') && keys.includes('traderRemark'))
    assert.ok(!keys.includes('opening'))
  }
})
test('纯数量单元格不附加股，订单数量/金额列及货币单位除外', () => {
  for (const kind of ['positions', 'orders', 'trades']) {
    for (const item of recordTableColumns(kind)) {
      assert.doesNotMatch(`${item.title}${item.secondTitle || ''}`, /[（(]\s*股\s*[）)]/)
    }
  }
  assert.equal(column('positions', 'holdingQty').secondTitle, undefined)
  assert.equal(column('trades', 'filledQuantity').secondTitle, undefined)
  assert.equal(column('positions', 'marginOccupied').secondTitle, '（CNY）')
  assert.match(column('orders', 'orderValueNumber').value({ quantity: 800 }), /股$/)
  assert.equal(column('orders', 'filledQuantity').value({ filledQuantity: 1200 }), '1,200')
  assert.equal(column('orders', 'reportQuantity').value({ reportQuantity: 3000 }), '3,000')
  assert.equal(column('trades', 'filledQuantity').value({ filledQuantity: 1200 }), '1,200')
  assert.equal(column('orders', 'orderValueNumber').value({ inputAmount: 1917, currency: 'CNY' }), '1,917.00 元')
  assert.equal(column('orders', 'orderValueNumber').value({ inputAmount: 1917, currency: 'HKD' }), '1,917.00 HKD')
})
test('持仓三列仅在账户和市场前增加 8px 间距，不影响其他表格', () => {
  const positions = recordTableColumns('positions')
  assert.deepEqual(positions.filter(item => item.gapBefore).map(item => [item.key, item.gapBefore]), [['account', 8], ['market', 8]])
  for (const kind of ['orders', 'trades']) {
    assert.ok(recordTableColumns(kind).every(item => !item.gapBefore))
  }
})
test('排序按升序、降序、默认循环，新列从升序开始', () => {
  let sort = nextTableSort({ key: '', direction: 'none' }, 'price')
  assert.deepEqual(sort, { key: 'price', direction: 'ascending' })
  sort = nextTableSort(sort, 'price')
  assert.equal(sort.direction, 'descending')
  assert.equal(nextTableSort(sort, 'price').direction, 'none')
  assert.deepEqual(nextTableSort(sort, 'name'), { key: 'name', direction: 'ascending' })
})
test('原始数值比较，空值双向置底，同值稳定且不修改输入', () => {
  const rows = [{ id: 'large', filledAmount: 1000000 }, { id: 'two', filledAmount: 2 }, { id: 'empty', filledAmount: null }, { id: 'negative', filledAmount: -5 }, { id: 'equal', filledAmount: 2 }, { id: 'zero', filledAmount: 0 }]
  const original = ids(rows)
  assert.deepEqual(ids(sortTableRecords(rows, 'trades', column('trades', 'filledAmount'), 'ascending')), ['negative', 'zero', 'two', 'equal', 'large', 'empty'])
  assert.deepEqual(ids(sortTableRecords(rows, 'trades', column('trades', 'filledAmount'), 'descending')), ['large', 'two', 'equal', 'zero', 'negative', 'empty'])
  assert.deepEqual(ids(rows), original)
  assert.equal(sortTableRecords(rows, 'trades', column('trades', 'filledAmount'), 'none'), rows)
})
test('派生列沿用业务口径，进度按原始比例而非显示百分比排序', () => {
  const position = demoRecords.positions[0]
  assert.equal(tableSortValue('positions', column('positions', 'price'), position), position.cost)
  assert.equal(tableSortValue('positions', column('positions', 'holdingQty'), position), position.qty)
  assert.equal(tableSortValue('positions', column('positions', 'valueWan'), position), position.value)
  const rows = [{ id: 'high', quantity: 1000, filledQuantity: 504, filledPrice: 2 }, { id: 'low', quantity: 1000, filledQuantity: 501, filledPrice: 2 }, { id: 'empty', quantity: 0 }]
  assert.deepEqual(ids(sortTableRecords(rows, 'orders', column('orders', 'fillProgress'), 'ascending')), ['low', 'high', 'empty'])
  assert.equal(tableSortValue('orders', column('orders', 'filledAmount'), rows[0]), 1008)
})
test('数量金额混合列按单位分组后排序，不把股数和元直接比较', () => {
  const rows = [{ id: 'amount', inputAmount: 2 }, { id: 'large', quantity: 1000 }, { id: 'small', quantity: 100 }]
  assert.deepEqual(ids(sortTableRecords(rows, 'orders', column('orders', 'orderValueNumber'), 'ascending')), ['small', 'large', 'amount'])
  assert.deepEqual(ids(sortTableRecords(rows, 'orders', column('orders', 'orderValueNumber'), 'descending')), ['large', 'small', 'amount'])
})
test('文本代码自然排序保留前导零，各表业务列均能排序', () => {
  const rows = [{ code: '000020', id: '20' }, { code: '000002', id: '2' }]
  assert.deepEqual(ids(sortTableRecords(rows, 'orders', column('orders', 'code'), 'ascending')), ['2', '20'])
  assert.equal(rows[0].code, '000020')
  for (const kind of ['positions', 'orders', 'trades']) {
    for (const col of recordTableColumns(kind).filter(item => item.key !== 'index')) {
      assert.doesNotThrow(() => sortTableRecords(demoRecords[kind], kind, col, 'ascending'))
    }
  }
})
