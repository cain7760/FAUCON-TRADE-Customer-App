import test from 'node:test'
import assert from 'node:assert/strict'
import { canUseMarketOrder, normalizeOrderType, orderTypeError } from './orderMarketRules.js'
import { hongKongDemoInstruments } from './hongKongInstruments.js'

test('港股系统单、手工单及带市场后缀的历史单均仅限价', () => {
  for (const symbol of [{ market: 'HK' }, { market: 'HK', isManual: true }, { code: '00700.HK' }]) {
    assert.equal(canUseMarketOrder(symbol), false)
    assert.equal(normalizeOrderType('market', symbol), 'limit')
    assert.match(orderTypeError('market', symbol), /港股仅支持限价/)
    assert.equal(orderTypeError('limit', symbol), '')
  }
})
test('其他市场维持市价能力；港股切回其他市场不自动恢复市价', () => {
  for (const market of ['SZ', 'SH', 'A', 'US']) {
    assert.equal(canUseMarketOrder({ market }), true)
    assert.equal(normalizeOrderType('market', { market }), 'market')
    assert.equal(normalizeOrderType('limit', { market }), 'limit')
  }
})
test('新增港股演示标的具有独立代码、港币及有效限价参考价', () => {
  assert.equal(hongKongDemoInstruments.length, 6)
  assert.equal(new Set(hongKongDemoInstruments.map(row => row.code)).size, 6)
  for (const row of hongKongDemoInstruments) {
    assert.match(row.code, /^\d{5}$/)
    assert.equal(row.market, 'HK'); assert.equal(row.currency, 'HKD')
    assert.ok(row.price > 0); assert.ok(row.lotSize > 0)
  }
})
