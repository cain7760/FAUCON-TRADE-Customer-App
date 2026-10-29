import test from 'node:test'
import assert from 'node:assert/strict'
import { demoRecords } from './fixtures.js'
import { detailSections, signedMoney } from './model.js'
import { recordTableColumns } from './recordTableColumns.js'
import { focusExportData, focusTableColumns, sortFocusRecords } from './focusTableColumns.js'

test('App 表格、详情、卡片共用的金额及持仓导出统一盈亏符号，保留颜色和数值排序', () => {
  const floating = recordTableColumns('positions').find(column => column.key === 'floatingProfit')
  for (const [amount, expected] of [[1234.56, '+1,234.56'], [-1234.56, '-1,234.56'], [0, '0.00'], [null, '--']]) {
    const row = { ...demoRecords.positions[0], floatingProfit: amount, dailyRealizedProfit: amount, totalProfit: amount }
    assert.equal(signedMoney(amount), expected)
    assert.equal(floating.value(row), expected)
    assert.equal(floating.tone(row), amount >= 0 ? 'equity-positive' : 'equity-negative')
    const fields = detailSections('positions', row, 1).flatMap(section => section.fields)
    for (const key of ['floatingProfit', 'dailyRealizedProfit', 'totalProfit']) assert.equal(fields.find(field => field.key === key).value, expected)
    const exported = focusExportData('positions', [row])
    assert.equal(exported.records[0][exported.header.indexOf('浮动盈亏')], expected)
    assert.equal(fields.find(field => field.key === 'value').value.startsWith('+'), false)
    assert.equal(row.floatingProfit, amount)
  }
  const rows = [-10, 2, 100].map((floatingProfit, id) => ({ id, floatingProfit }))
  const column = focusTableColumns('positions').find(column => column.key === 'floatingProfit')
  assert.deepEqual(sortFocusRecords(rows, 'positions', column, 'ascending').map(row => row.floatingProfit), [-10, 2, 100])
  assert.deepEqual(sortFocusRecords(rows, 'positions', column, 'descending').map(row => row.floatingProfit), [100, 2, -10])
})
