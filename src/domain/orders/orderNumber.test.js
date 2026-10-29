import test from 'node:test'
import assert from 'node:assert/strict'
import { formatOrderNumber, nextOrderNumber } from './orderNumber.js'

test('按市场、衍生品、日期、序列组成18位字符串，长整数末位不丢失', () => {
  assert.equal(formatOrderNumber('SZ', '2026-01-12', 12), '100090020260112012')
  assert.equal(formatOrderNumber('SH', '20260112', 12), '100090020260112012')
  assert.equal(formatOrderNumber('HK', '2026-01-12', 12), '200090020260112012')
  assert.equal(formatOrderNumber('US', '2026-01-12', 12), '300090020260112012')
  const first = formatOrderNumber('SZ', '2026-01-12', 1)
  const second = formatOrderNumber('SZ', '2026-01-12', 2)
  assert.equal(typeof first, 'string')
  assert.notEqual(first, second)
  assert.equal(JSON.parse(JSON.stringify({ orderNo: first })).orderNo, first)
})
test('分配序列跨账户去重，市场与日期独立，999用尽时明确拒绝', () => {
  const rows = [1, 2].map(sequence => ({ orderNo: formatOrderNumber('SZ', '2026-01-12', sequence) }))
  assert.equal(nextOrderNumber(rows, 'SH', '2026-01-12'), '100090020260112003')
  assert.equal(nextOrderNumber(rows, 'HK', '2026-01-12'), '200090020260112001')
  assert.equal(nextOrderNumber(rows, 'SZ', '2026-01-13'), '100090020260113001')
  const full = Array.from({ length: 999 }, (_, index) => ({ orderNo: formatOrderNumber('SZ', '2026-01-12', index + 1) }))
  assert.throws(() => nextOrderNumber(full, 'SZ', '2026-01-12'), /序号已用尽/)
  for (const sequence of [0, -1, 1000, 1.5]) assert.throws(() => formatOrderNumber('SZ', '2026-01-12', sequence))
  for (const date of ['2026-02-29', '2026-13-01', 'bad']) assert.throws(() => formatOrderNumber('SZ', date, 1))
  assert.throws(() => formatOrderNumber('unknown', '2026-01-12', 1))
})
