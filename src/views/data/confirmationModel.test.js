import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmationColumns, createConfirmationRecords, groupConfirmations, sortConfirmations } from './confirmationModel.js'

test('交易确认书快照保留参考页的三组十条记录及原始编号', () => {
  const rows = createConfirmationRecords()
  assert.equal(rows.length, 10)
  assert.equal(new Set(rows.map(row => row.id)).size, 10)
  assert.equal(rows[0].confirmationNo, 'SWAP-cw0349_test-26102666927')
  assert.equal(rows[0].contractNo, 'SWP-cw0349_test-2610260003')
  assert.equal(rows.at(-1).confirmationNo, 'SWAP-2403001-26101266918')
  assert.equal(rows.at(-1).contractNo, 'SWP-2403001-2610120001')
  assert.equal(rows[3].counterpartyNo, '2404001')
  assert.equal(rows[3].counterparty, 'cw0341_test')
  assert.equal(rows[0].operatedAt, '2026-10-26 10:50:30')
  assert.ok(rows.every(row => row.operator === 'Emily_AI'))
})
test('全部参考字段都有值或明确的空值，不将未知字段编成数据', () => {
  assert.equal(confirmationColumns.length, 22)
  for (const row of createConfirmationRecords()) {
    for (const column of confirmationColumns) assert.ok(Object.hasOwn(row, column.key), column.key)
    assert.equal(row.eventNo, '')
    assert.equal(row.department, '')
    assert.ok(!Object.keys(row).some(key => key.startsWith('email')))
    assert.equal(row.tradeCurrency, 'CNY')
    assert.equal(row.settlementCurrency, 'CNY')
  }
})
test('按确认书文档编号分组，明细不丢失，数量与参考页一致', () => {
  const rows = createConfirmationRecords(), groups = groupConfirmations(rows)
  assert.deepEqual(groups.map(group => group.children.length), [3, 3, 4])
  assert.deepEqual(groups.map(group => group.documentNo), ['cw0349_test-20261026', 'cw0341_test-20261013', 'cw0339_test-20261012'])
  assert.deepEqual(groups.flatMap(group => group.children), rows)
  assert.ok(groups.every(group => group.isDocument && group.template === '汇总交易确认书模板_20250718-致富.xlsx'))
})
test('排序保持输入快照及分组身份，重复创建不会共享可变行', () => {
  const rows = createConfirmationRecords(), before = structuredClone(rows)
  assert.deepEqual(sortConfirmations(rows), rows)
  const sorted = sortConfirmations(rows, { key: 'confirmationNo', direction: 'ascending' })
  assert.deepEqual(rows, before)
  assert.notDeepEqual(sorted, rows)
  assert.equal(groupConfirmations(sorted).flatMap(group => group.children).length, 10)
  rows[0].operator = 'changed'
  assert.equal(createConfirmationRecords()[0].operator, 'Emily_AI')
})
