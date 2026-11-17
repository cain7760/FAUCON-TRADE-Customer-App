import test from 'node:test'
import assert from 'node:assert/strict'
import { povParametersError } from './povSchedule.js'
const now = new Date('2026-11-17T10:20:30+08:00')
test('填写开始时间时检查当前市场时间，保留可选端点', () => {
  for (const market of ['SZ', 'HK']) {
    for (const executionTime of [['10:19', '11:00'], ['10:20', ''], ['10:20:29', '11:00']]) {
      assert.equal(povParametersError({ market }, { executionTime, participation: 25 }, now, true), '开始时间不能早于当前时间')
    }
    for (const executionTime of [['', ''], ['', '11:00'], ['10:21', ''], ['10:20:30', '11:00']]) {
      assert.equal(povParametersError({ market }, { executionTime, participation: 25 }, now, true), '')
    }
  }
})
test('开始时间校验使用标的市场时区', () => {
  const clock = new Date('2026-11-17T10:20:30+08:00')
  assert.equal(povParametersError({ market: 'US' }, { executionTime: ['21:19', '22:00'], participation: 25 }, clock, true), '开始时间不能早于当前时间')
  assert.equal(povParametersError({ market: 'US' }, { executionTime: ['21:21', '22:00'], participation: 25 }, clock, true), '')
})
