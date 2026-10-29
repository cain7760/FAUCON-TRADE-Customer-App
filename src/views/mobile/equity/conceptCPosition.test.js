import test from 'node:test'
import assert from 'node:assert/strict'
import { focusPositions } from './fixtures.js'
import { detailSections } from './model.js'
import { canCloseConceptCPosition, conceptCPositionAdditionalSections, conceptCPositionColumnWidths, conceptCPositionMetrics } from './conceptCPosition.js'

const position = focusPositions.find(record => record.code === '000002' && record.account === 'TZS_T0')

test('C 持仓呈现复用原数据，不把可平数量误当持仓数量', () => {
  const original = structuredClone(position)
  const card = conceptCPositionMetrics(position)
  const drawer = conceptCPositionMetrics(position, true)
  assert.equal(card.length, 4)
  assert.equal(drawer.length, 6)
  assert.equal(card.find(field => field.key === 'qty').value, '44,100')
  assert.equal(card.find(field => field.key === 'value').value, '144,207.00')
  assert.equal(drawer.find(field => field.key === 'marginOccupied').value, '13,891.50')
  assert.deepEqual(position, original)
})

test('C 摘要以外的完整字段不丢失，备注与账户仍可查看', () => {
  const visibleKeys = ['name', 'code', 'price', 'qty', 'available', 'value', 'marginOccupied', 'marginRate', 'floatingProfit']
  const rest = conceptCPositionAdditionalSections(position, 7).flatMap(section => section.fields)
  const original = detailSections('positions', position, 7).flatMap(section => section.fields)
  assert.deepEqual(rest.map(field => field.key).sort(), original.map(field => field.key).filter(key => !visibleKeys.includes(key)).sort())
  assert.ok(rest.find(field => field.key === 'account').value.includes('TZS_T0'))
  assert.ok(rest.some(field => field.key === 'orderRemark'))
  assert.ok(rest.some(field => field.key === 'traderRemark'))
})

test('C 保留市场精度与保证金人民币口径，缺失比率不显示为 0', () => {
  const fields = conceptCPositionMetrics({ ...position, market: 'HK', currency: 'HKD', cost: 12.345, price: 12.678, marginOccupied: 100, marginRate: null }, true)
  assert.equal(fields[0].value, '12.345')
  assert.equal(fields[1].value, '12.678')
  assert.equal(fields[3].label, '市值（HKD）')
  assert.equal(fields[4].value, '92.00')
  assert.equal(fields[5].value, '--')
})

test('C 仅现有多仓且有可用数量时允许进入平仓，不扩大交易能力', () => {
  assert.equal(canCloseConceptCPosition(position), true)
  assert.equal(canCloseConceptCPosition({ ...position, available: 0 }), false)
  assert.equal(canCloseConceptCPosition({ ...position, available: null }), false)
  assert.equal(canCloseConceptCPosition({ ...position, direction: '空' }), false)
})

test('C 首屏四列宽度适配原 393px 手机壳，其余列保持横向可达', () => {
  assert.equal(Object.values(conceptCPositionColumnWidths).reduce((sum, width) => sum + width, 0), 391)
})
