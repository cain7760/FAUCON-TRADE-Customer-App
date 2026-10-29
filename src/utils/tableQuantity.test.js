import test from 'node:test'
import assert from 'node:assert/strict'
import { withoutShareUnit } from './tableQuantity.js'

test('数量单元格只移除股，保留千分位、小数、空值与全部货币单位', () => {
  assert.equal(withoutShareUnit('1,234.567 股'), '1,234.567')
  assert.equal(withoutShareUnit('100 股、200 股/300 股'), '100、200/300')
  for (const value of ['1,917.00 元', '1,917.00 CNY', '1,917.00 港元', '1,917.00 HKD', '1,917.00 USD', '--', 0, null]) assert.equal(withoutShareUnit(value), value)
})
