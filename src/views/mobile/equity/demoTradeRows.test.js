import test from 'node:test'
import assert from 'node:assert/strict'
import { demoRecords } from './fixtures.js'
import { demoTradeRows } from './demoLedger.js'
test('旧缓存成交沿用母单日期，撤单不丢弃实际成交，也不生成零成交回报', () => {
  const orders = structuredClone(demoRecords.orders)
  for (const row of orders) { row.orderTime = '2026-09-11' + row.orderTime.slice(10); row.status = row.filledQuantity ? '部撤' : '撤单' }
  const trades = demoTradeRows(orders)
  assert.equal(trades.length, demoRecords.trades.length)
  assert.ok(trades.every(row => row.tradeDate === '20260911' && row.filledTime.startsWith('2026-09-11') && row.status === '部撤'))
  assert.deepEqual(trades.map(row => [row.tradeNo, row.filledQuantity, row.filledAmount, row.filledPrice]), demoRecords.trades.map(row => [row.tradeNo, row.filledQuantity, row.filledAmount, row.filledPrice]))
  assert.deepEqual(demoTradeRows([]), [])
})
