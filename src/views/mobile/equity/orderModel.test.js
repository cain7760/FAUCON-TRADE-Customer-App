import test from 'node:test'
import assert from 'node:assert/strict'
import { orderInstruments } from './fixtures.js'
import { algorithmOptions, applyBookPrice, canPreviewOrder, changeOrderMode, changeOrderType, defaultOrderAlgorithm, demoOrderCash, orderBookLevels, orderEstimates, orderError, validPov } from './orderModel.js'
const symbol = { code: '000001', market: 'SZ', price: 11.78 }
const draft = { type: 'limit', price: 11.78, mode: 'quantity', value: 900, unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: 'DMA', pov: { hours: 1, minutes: 0, participation: 10 } }
const estimate = d => orderEstimates(d, symbol, demoOrderCash.TZS_T0, 9300)
test('执行算法仅保留 Customer 三个选项及名称，不添加解释文案', () => {
  assert.deepEqual(algorithmOptions, [{ value: 'POV', label: 'POV' }, { value: 'DMA', label: 'DMA' }, { value: 'none', label: '无需算法' }])
})
test('港股标准与手工标的仅限价，隐藏选项之外仍拦截市价预览', () => {
  for (const isManual of [false, true]) {
    const hk = { code: '00700', market: 'HK', price: 320, isManual }
    const market = { ...draft, type: 'market', price: '', value: 100 }
    const e = orderEstimates(market, hk, 1000000, 1000)
    assert.match(orderError(market, hk, e, 'buy'), /港股仅支持限价/)
    assert.equal(canPreviewOrder(market, hk, e, 'sell'), false)
    changeOrderType(market, 'market', hk)
    assert.equal(market.type, 'limit'); assert.equal(market.value, '')
    const limit = { ...draft, price: 320, value: 100 }
    assert.equal(orderError(limit, hk, orderEstimates(limit, hk, 1000000, 1000), 'buy'), '')
    assert.equal(orderError(limit, hk, orderEstimates(limit, hk, 1000000, 1000), 'sell'), '')
  }
})
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
test('重复点击价格或数量模式不丢输入，真正切换才重置', () => {
  const d = { ...draft }
  changeOrderType(d, 'limit'); changeOrderMode(d, 'quantity')
  assert.equal(d.value, 900)
  changeOrderMode(d, 'amount'); assert.equal(d.value, '')
  d.value = 10000; changeOrderType(d, 'market')
  assert.equal(d.mode, 'quantity'); assert.equal(d.value, '')
})
test('盘口与 Customer 确定性档位一致；无行情不虚构深度', () => {
  const rows = orderBookLevels(symbol)
  assert.equal(rows.length, 10)
  assert.deepEqual(rows[0], { rank: 1, bid: 11.78, bidQuantity: 8300, ask: 11.79, askQuantity: 9000 })
  assert.equal(rows[9].bid, 11.69); assert.equal(rows[9].ask, 11.88)
  assert.equal(orderBookLevels(symbol, 5).length, 5)
  assert.deepEqual(orderBookLevels(null), [])
  assert.deepEqual(orderBookLevels({ code: 'custom', isManual: true }), [])
})
test('盘口限价回填保留限价数量；市价切限价时重置', () => {
  const d = { ...draft }
  applyBookPrice(d, 11.79); assert.equal(d.price, 11.79); assert.equal(d.value, 900)
  d.type = 'market'; applyBookPrice(d, 11.8)
  assert.equal(d.type, 'limit'); assert.equal(d.value, '')
  applyBookPrice(d, NaN); assert.equal(d.price, 11.8)
})
test('任意整数百分比独立按买卖容量取整手', () => {
  const e = estimate({ ...draft, mode: 'percentage', fraction: 37 })
  assert.equal(e.buy, 29600); assert.equal(e.sell, 3400)
})
test('Customer 非标准手工标的允许无参考价的市价单并绕过容量', () => {
  const custom = { code: 'CUSTOM', name: '非标准标的', isManual: true }
  const d = { ...draft, execution: 'highTouch', type: 'market', value: 3 }
  const e = orderEstimates(d, custom, 0, 0)
  assert.equal(e.maxBuy, Number.MAX_SAFE_INTEGER)
  assert.equal(orderError(d, custom, e, 'buy'), '')
  assert.equal(orderError(d, custom, e, 'sell'), '')
  assert.equal(e.price, 0); assert.equal(e.buyAmount, 0)
})
test('全部标的与 Customer 可选演示池一致，不局限于当前持仓', () => {
  assert.equal(orderInstruments.length, 238)
  assert.equal(new Set(orderInstruments.map(row => row.code)).size, 238)
  assert.equal(orderInstruments.filter(row => row.market === 'HK').length, 28)
  assert.equal(orderInstruments.find(row => row.code === '100001').name, '华远科技 001')
})
test('金额小数和万元浮点尾数不会误禁用按钮；超限由预览提示', () => {
  for (const value of [1178.01, 1.239 * 10000]) {
    const d = { ...draft, mode: 'amount', value }
    assert.equal(canPreviewOrder(d, symbol, estimate(d), 'buy'), true)
  }
  const d = { ...draft, value: 9400 }
  assert.equal(canPreviewOrder(d, symbol, estimate(d), 'sell'), true)
  assert.match(orderError(d, symbol, estimate(d), 'sell'), /超出最大可卖/)
  assert.equal(canPreviewOrder({ ...draft, value: 101 }, symbol, estimate({ ...draft, value: 101 }), 'buy'), false)
})
