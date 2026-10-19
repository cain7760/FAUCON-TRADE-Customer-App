import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultOrderAlgorithm, demoOrderCash, orderEstimates, orderError, validPov } from './orderModel.js'
const symbol = { code: '000001', market: 'SZ', price: 11.78 }
const draft = { type: 'limit', price: 11.78, mode: 'quantity', value: 900, unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: 'DMA', pov: { hours: 1, minutes: 0, participation: 10 } }
const estimate = d => orderEstimates(d, symbol, demoOrderCash.TZS_T0, 9300)
test('账户容量、数量与金额预估来自 PC 口径', () => {
  const e = estimate(draft)
  assert.equal(e.maxBuy, 80200); assert.equal(e.maxSell, 9300)
  assert.equal(e.buy, 900); assert.equal(e.sell, 900)
  assert.equal(e.buyAmount, 10602); assert.equal(orderError(draft, symbol, e, 'buy'), '')
})
test('百分比买卖分别按最大可买可卖取整手', () => {
  const e = estimate({ ...draft, mode: 'percentage', fraction: 25 })
  assert.equal(e.buy, 20000); assert.equal(e.sell, 2300)
})
test('金额、万元、万股换算及市价参考价', () => {
  assert.equal(estimate({ ...draft, mode: 'amount', value: 10000, amountUnit: 'wan' }).buy, 800)
  assert.equal(estimate({ ...draft, value: 1, unit: 'wan' }).buy, 10000)
  assert.equal(estimate({ ...draft, type: 'market', price: 0 }).price, 11.78)
})
test('元与万元往返切换保持委托金额和预估数量不变', () => {
  const d = { ...draft, mode: 'amount', value: 10000 }
  for (const amountUnit of ['yuan', 'wan', 'yuan']) {
    const e = estimate({ ...d, amountUnit })
    assert.equal(e.inputAmount, 10000)
    assert.equal(e.buy, 800)
    assert.equal(e.buyAmount, 9424)
  }
})
test('拒绝空标的、零价、负数、碎股与超限订单', () => {
  assert.match(orderError(draft, null, estimate(draft), 'buy'), /标的/)
  for (const value of [0, -100, 101, Infinity, 1.5]) {
    const d = { ...draft, value }; assert.ok(orderError(d, symbol, estimate(d), 'buy'))
  }
  const d = { ...draft, value: 9400 }; assert.match(orderError(d, symbol, estimate(d), 'sell'), /超出最大可卖/)
  const zero = { ...draft, price: 0 }; assert.match(orderError(zero, symbol, estimate(zero), 'buy'), /大于 0/)
})
test('无标的或零价不产生 Infinity 或错误容量', () => {
  assert.equal(orderEstimates(draft, null, 1000, 9300).maxSell, 0)
  assert.equal(estimate({ ...draft, mode: 'amount', price: 0 }).buy, 0)
})
test('POV 时间和占比边界', () => {
  assert.ok(validPov(draft.pov)); assert.ok(validPov({ hours: 23, minutes: 59, participation: 25 }))
  for (const pov of [{ hours: 0, minutes: 0, participation: 10 }, { hours: 24, minutes: 0, participation: 10 }, { hours: 1, minutes: 60, participation: 10 }, { hours: 1, minutes: 0, participation: 26 }, { hours: '', minutes: 10, participation: 10 }]) assert.equal(validPov(pov), false)
})
test('默认算法遵循上海时区 A 股 14:55 分界', () => {
  assert.equal(defaultOrderAlgorithm('SZ', new Date('2026-10-19T06:54:59Z')), 'POV')
  assert.equal(defaultOrderAlgorithm('SH', new Date('2026-10-19T06:55:00Z')), 'DMA')
})
test('金额预估按分计算，不受浮点截断误差影响', () => {
  assert.equal(estimate({ ...draft, price: 11.79, value: 20000 }).buyAmount, 235800)
  const d = { ...draft, price: 11.789 }
  assert.match(orderError(d, symbol, estimate(d), 'buy'), /两位小数/)
  const fractional = { ...draft, value: 1.01, unit: 'wan' }
  assert.match(orderError(fractional, symbol, estimate(fractional), 'buy'), /整数/)
})
