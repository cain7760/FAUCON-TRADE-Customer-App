import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPnl } from './pnlFormat.js'

const money = value => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
test('盈亏正数加正号、负数一个减号，零及负零不带符号', () => {
  for (const [value, expected] of [[1234.56, '+1,234.56'], [-1234.56, '-1,234.56'], [0, '0.00'], [-0, '0.00'], ['1234.56', '+1,234.56']]) {
    assert.equal(formatPnl(value, money), expected)
  }
})
test('空值和非有限值不伪造盈亏，保留原格式化精度', () => {
  for (const value of [null, undefined, '', NaN, Infinity, -Infinity, '无报价']) assert.equal(formatPnl(value, money), '--')
  assert.equal(formatPnl(1.239, value => String(Math.trunc(value * 100) / 100)), '+1.23')
  assert.equal(formatPnl(-1.239, value => String(Math.trunc(value * 100) / 100)), '-1.23')
})
