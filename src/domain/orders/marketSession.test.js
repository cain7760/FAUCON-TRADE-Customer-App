import test from 'node:test'
import assert from 'node:assert/strict'
import { expireOrdersAtClose, hasOrderSessionClosed, marketClock } from './marketSession.js'

const order = overrides => ({ id: '1', market: 'SZ', tradingDate: '2026-10-27', status: '已报', quantity: 1000, filledQuantity: 0, reportQuantity: 1000, frozenMargin: 4000, instructionStatusCode: '2', entrustments: [{ status: '已报' }], ...overrides })
test('按各市场当地最终收盘时间，A 股午休不撤单，港股含 CAS', () => {
  for (const [market, before, close] of [
    ['SH', '2026-10-27T06:59:59Z', '2026-10-27T07:00:00Z'],
    ['HK', '2026-10-27T08:09:59Z', '2026-10-27T08:10:00Z'],
    ['US', '2026-10-27T19:59:59Z', '2026-10-27T20:00:00Z'],
  ]) {
    assert.equal(hasOrderSessionClosed(order({ market }), new Date(before)), false)
    assert.equal(hasOrderSessionClosed(order({ market }), new Date(close)), true)
  }
  assert.equal(hasOrderSessionClosed(order(), new Date('2026-10-27T04:00:00Z')), false)
})
test('美股冬夏令时、上海跨日及交易所半日市不使用电脑时区', () => {
  const us = order({ market: 'US', tradingDate: '2026-12-01' })
  assert.equal(hasOrderSessionClosed(us, new Date('2026-12-01T20:59:59Z')), false)
  assert.equal(hasOrderSessionClosed(us, new Date('2026-12-01T21:00:00Z')), true)
  assert.deepEqual(marketClock(new Date('2026-10-27T20:00:00Z'), 'US'), { date: '2026-10-27', time: '16:00:00' })
  assert.equal(hasOrderSessionClosed(order({ market: 'US', tradingDate: undefined, orderTime: '2026-10-28 03:59:00' }), new Date('2026-10-27T20:00:00Z')), true)
  for (const [market, date, close] of [
    ['US', '2026-11-27', '2026-11-27T18:00:00Z'],
    ['US', '2026-12-24', '2026-12-24T18:00:00Z'],
    ['HK', '2026-02-16', '2026-02-16T04:10:00Z'],
    ['HK', '2026-12-24', '2026-12-24T04:10:00Z'],
    ['HK', '2026-12-31', '2026-12-31T04:10:00Z'],
  ]) {
    const value = order({ market, tradingDate: date })
    assert.equal(hasOrderSessionClosed(value, new Date(Date.parse(close) - 1000)), false)
    assert.equal(hasOrderSessionClosed(value, new Date(close)), true)
  }
})
test('零成交撤单、部分成交部撤、释放冻结，不修改已成交数据及指令状态', () => {
  const zero = order()
  const partial = order({ id: '2', filledQuantity: 400, filledPrice: 10.123, filledAmount: 4049.2 })
  const before = structuredClone(partial)
  assert.deepEqual(expireOrdersAtClose([zero, partial], new Date('2026-10-27T07:00:00Z')), ['1', '2'])
  assert.equal(zero.status, '撤单'); assert.equal(zero.canceledQuantity, 1000)
  assert.equal(partial.status, '部撤'); assert.equal(partial.canceledQuantity, 600)
  for (const row of [zero, partial]) { assert.equal(row.reportQuantity, 0); assert.equal(row.frozenMargin, 0) }
  for (const key of ['filledQuantity', 'filledPrice', 'filledAmount', 'instructionStatusCode', 'entrustments']) assert.deepEqual(partial[key], before[key])
  const snapshot = structuredClone([zero, partial])
  assert.deepEqual(expireOrdersAtClose([zero, partial], new Date('2026-10-28T07:00:00Z')), [])
  assert.deepEqual([zero, partial], snapshot)
})
test('金额单撤回剩余预算，保留原币种和成交金额，不按剩余股数估算', () => {
  const row = order({ inputAmount: 10100.13, filledQuantity: 400, filledAmount: 4049.2, filledPrice: 10.123, currency: 'HKD' })
  expireOrdersAtClose([row], new Date('2026-10-27T07:00:00Z'))
  assert.equal(row.canceledAmount, 6050.93); assert.equal(row.canceledQuantity, 600)
  assert.equal(row.currency, 'HKD'); assert.equal(row.inputAmount, 10100.13)
})
test('所有非终态和旧日委托补撤；终态、未来、未知市场和无效时间不擅改', () => {
  for (const status of ['未报', '待报', '已报', '待改', '待撤', '部成', '异常']) {
    const row = order({ status, tradingDate: '2026-10-26' })
    assert.equal(expireOrdersAtClose([row], new Date('2026-10-27T00:00:00Z')).length, 1)
  }
  for (const row of [
    ...['全成', '撤单', '部撤', '拒单'].map(status => order({ status })),
    order({ filledQuantity: 1000 }), order({ tradingDate: '2026-10-28' }),
    order({ market: 'unknown' }), order({ tradingDate: 'bad' }), order({ tradingDate: '2026-02-30' }),
  ]) {
    const before = structuredClone(row)
    assert.deepEqual(expireOrdersAtClose([row], new Date('2026-10-27T08:00:00Z')), [])
    assert.deepEqual(row, before)
  }
})
test('服务端实际收市时刻优先，带偏移避免设备时区歧义', () => {
  const row = order({ market: 'HK', sessionCloseAt: '2026-10-27T16:08:20+08:00' })
  assert.equal(hasOrderSessionClosed(row, new Date('2026-10-27T08:08:19Z')), false)
  assert.equal(hasOrderSessionClosed(row, new Date('2026-10-27T08:08:20Z')), true)
  assert.equal(hasOrderSessionClosed(order({ sessionCloseAt: '2026-10-27 15:00:00' }), new Date('2026-10-27T08:00:00Z')), false)
})

test('固定状态样例保留展示状态，普通新委托仍按收盘规则撤回', () => {
  const sample = order({ demoStatusSample: true, status: '已报' })
  const submitted = order({ id: 'submitted', status: '已报' })
  const before = structuredClone(sample)
  assert.deepEqual(expireOrdersAtClose([sample, submitted], new Date('2026-10-28T08:00:00Z')), ['submitted'])
  assert.deepEqual(sample, before)
  assert.equal(submitted.status, '撤单')
})
