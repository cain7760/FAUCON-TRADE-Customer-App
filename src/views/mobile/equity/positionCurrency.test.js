import test from 'node:test'
import assert from 'node:assert/strict'
import { positionMarginInCny } from './positionCurrency.js'
import { detailSections } from './model.js'

test('App 保证金按 Customer PC 汇率换算 CNY，已换算值不重复转换', () => {
  assert.equal(positionMarginInCny({ currency: 'CNY', marginOccupied: 1000 }), 1000)
  assert.equal(positionMarginInCny({ currency: 'HKD', marginOccupied: 1000 }), 920)
  assert.equal(positionMarginInCny({ currency: 'USD', marginOccupied: 1000 }), 7180)
  assert.equal(positionMarginInCny({ market: 'HK', marginOccupied: 1000 }), 920)
  assert.equal(positionMarginInCny({ currency: 'HKD', marginCurrency: 'CNY', marginOccupied: 920 }), 920)
  assert.equal(positionMarginInCny({ currency: 'EUR', marginOccupied: 1000 }), null)
})

test('持仓详情保证金名称及金额统一为 CNY，保留标的原币种', () => {
  const row = { currency: 'USD', marginOccupied: 1000, account: 'TZS_T0' }
  const fields = detailSections('positions', row, 1).flatMap(section => section.fields)
  assert.equal(fields.find(field => field.key === 'marginOccupied').label, '保证金占用(CNY)')
  assert.equal(fields.find(field => field.key === 'marginOccupied').value, '7,180.00')
  assert.equal(fields.find(field => field.key === 'currency').value, 'USD')
})
