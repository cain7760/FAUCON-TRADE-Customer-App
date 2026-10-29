import test from 'node:test'
import assert from 'node:assert/strict'
import { orderAccountOverview } from './accountOverview.js'
import { demoRecords } from './fixtures.js'
import { demoOrderCash, orderEstimates } from './orderModel.js'

test('账户概要与下单容量使用同一可用资金口径', () => {
  assert.deepEqual(orderAccountOverview('TZS_T0', demoRecords.positions), { available: 945527.41, marketValue: 3688487, floatingProfit: 26012 })
  assert.deepEqual(orderAccountOverview('TZS_T1', demoRecords.positions), { available: 620800, marketValue: 7376974, floatingProfit: 52024 })
  assert.equal(demoOrderCash.TZS_T0, 945527.41)
  assert.equal(orderEstimates({ type: 'limit', price: 11.78, mode: 'quantity', value: 100, unit: 'shares' }, { price: 11.78 }, demoOrderCash.TZS_T0, 9300).maxBuy, 80200)
})
test('概要市场价值和浮动盈亏按 Customer 演示汇率换算 CNY', () => {
  const positions = [{ account: 'TZS_T0', currency: 'HKD', value: 100, floatingProfit: -10 },
    { account: 'TZS_T0', currency: 'USD', value: 100, floatingProfit: 10 },
    { account: 'TZS_T1', currency: 'CNY', value: 9999, floatingProfit: 9999 }]
  assert.deepEqual(orderAccountOverview('TZS_T0', positions), { available: 945527.41, marketValue: 810, floatingProfit: 62.6 })
  assert.deepEqual(orderAccountOverview('UNKNOWN', positions), { available: null, marketValue: 0, floatingProfit: 0 })
})
test('新版概要汇总列表多账户且重复账户不会重复累计', () => {
  assert.deepEqual(orderAccountOverview(['TZS_T0', 'TZS_T1', 'TZS_T0'], demoRecords.positions), {
    available: 1566327.41, marketValue: 11065461, floatingProfit: 78036,
  })
  assert.deepEqual(orderAccountOverview([], demoRecords.positions), { available: null, marketValue: 0, floatingProfit: 0 })
})
