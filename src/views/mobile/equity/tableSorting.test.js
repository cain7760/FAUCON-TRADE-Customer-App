import test from 'node:test'
import assert from 'node:assert/strict'
import { demoRecords } from './fixtures.js'
import { recordTableColumns } from './recordTableColumns.js'
import { nextTableSort, sortTableRecords, tableSortValue } from './tableSorting.js'

const ids = rows => rows.map(row => row.id)
const column = (kind, key) => recordTableColumns(kind).find(item => item.key === key)
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
