import test from 'node:test'
import assert from 'node:assert/strict'
import { demoRecords } from './fixtures.js'
import { addSearchHistory, filterSymbolRecords, normalizeSymbolHistory, resolveHistorySymbol, symbolHistoryLabel } from './symbolSearch.js'

const records = demoRecords.positions.filter(row => row.account === 'TZS_T0')
test('标的搜索支持名称、代码、市场后缀和拼音首字母，不区分大小写及空格', () => {
  for (const query of ['平安银行', '000001', '000001.sz', ' payh ']) {
    assert.equal(filterSymbolRecords(records, query)[0]?.code, '000001')
  }
  assert.equal(filterSymbolRecords(records, 'shfa')[0]?.code, '000020')
  assert.equal(filterSymbolRecords(records, '不存在').length, 0)
})
test('空查询保留当前分类的全部标的与原始顺序', () => {
  assert.deepEqual(filterSymbolRecords(records), records)
  assert.deepEqual(filterSymbolRecords(records.slice(0, 2)).map(row => row.code), ['000001', '002459'])
})
test('搜索历史去重、最近优先、不保存空词且不修改原数组', () => {
  const history = ['贵州茅台', 'PAYH']
  assert.deepEqual(addSearchHistory(history, ' payh '), ['payh', '贵州茅台'])
  assert.deepEqual(addSearchHistory(history, '  '), history)
  assert.deepEqual(history, ['贵州茅台', 'PAYH'])
  assert.equal(addSearchHistory([], 'a'.repeat(100))[0].length, 80)
  assert.equal(addSearchHistory(Array.from({ length: 8 }, (_, i) => `查询${i}`), '新查询').length, 8)
})
test('历史标签以唯一标的的完整名称和代码显示，兼容旧名称和拼音历史', () => {
  for (const term of ['000001.SZ', '000001', '平安银行', 'PAYH']) {
    assert.equal(symbolHistoryLabel(records, term), '平安银行（000001）')
  }
  assert.equal(resolveHistorySymbol(records, '600'), null)
  assert.equal(symbolHistoryLabel(records, '600'), '')
  assert.equal(resolveHistorySymbol(records, ''), null)
  assert.equal(symbolHistoryLabel(records, '不存在'), '')
})
test('旧历史移除模糊或无效搜索词，具体标的规范化并去重', () => {
  assert.deepEqual(normalizeSymbolHistory(records, ['600', '平安银行', '000001.SZ', 'PAYH', '不存在', null]), ['000001.SZ'])
  assert.deepEqual(normalizeSymbolHistory(records, null), [])
  const selected = addSearchHistory(normalizeSymbolHistory(records, ['600']), '600036.SH')
  assert.equal(symbolHistoryLabel(records, selected[0]), '招商银行（600036）')
})
