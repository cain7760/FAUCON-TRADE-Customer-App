import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidPovDuration, povDeadline, povDeadlineText } from './povSchedule.js'
const end = (market, now, hours = 1, minutes = 0, extra = {}) => povDeadline({ market, ...extra }, hours, minutes, new Date(now))

test('当前时间精确到秒，运行一小时保留秒数', () => {
  assert.equal(end('SZ', '2026-11-02T10:00:25+08:00').end, '11:00:25')
})
test('按A股与港股午休分别跳过，不把休市计入运行时间', () => {
  assert.equal(end('SH', '2026-11-02T11:00:25+08:00').end, '13:30:25')
  assert.equal(end('HK', '2026-11-02T11:30:25+08:00').end, '13:30:25')
  assert.equal(end('SZ', '2026-11-02T11:30:00+08:00').end, '14:00:00')
  assert.equal(end('HK', '2026-11-02T12:30:45+08:00').end, '14:00:00')
})
test('午休前刚好运行完即结束，开盘前从开盘开始计时', () => {
  assert.equal(end('SZ', '2026-11-02T10:30:00+08:00').end, '11:30:00')
  assert.equal(end('SZ', '2026-11-02T09:00:25+08:00').end, '10:30:00')
})
test('收盘为硬上限，不顺延次日；收盘后标明已收盘', () => {
  assert.equal(end('SZ', '2026-11-02T14:40:25+08:00').end, '15:00:00')
  assert.equal(end('HK', '2026-11-02T15:50:25+08:00').end, '16:10:00')
  assert.equal(povDeadlineText(end('SZ', '2026-11-02T15:00:00+08:00')), '15:00:00（已收盘）')
})
test('六小时三十分允许，再多一分钟及非法参数拒绝', () => {
  for (const [h, m] of [[0,1],[5,59],[6,0],[6,30],['6','30']]) assert.ok(isValidPovDuration(h,m))
  for (const [h, m] of [[0,0],[6,31],[7,0],[23,59],[-1,0],[1,60],[1.5,0],[null,1],['',1],[1,undefined],[Infinity,0]]) {
    assert.equal(isValidPovDuration(h,m), false)
    assert.equal(povDeadline({ market: 'SZ' },h,m),null)
  }
})
test('美股无午休，按美东日期、冬夏令时计算，与设备时区无关', () => {
  assert.equal(end('US', '2026-10-27T15:00:25Z').end, '12:00:25')
  assert.equal(end('NASDAQ', '2026-11-02T16:00:25Z').end, '12:00:25')
  assert.equal(end('US', '2026-11-03T04:00:00Z').date, '2026-11-02')
  assert.equal(end('US', '2026-11-03T04:00:00Z').state, 'closed')
})
test('特殊半日市与实际收市回报覆盖普通收市时间，精确到秒', () => {
  assert.equal(end('HK', '2026-12-24T11:50:00+08:00').end, '12:10:00')
  assert.equal(end('US', '2026-11-27T12:40:00-05:00').end, '13:00:00')
  assert.equal(end('HK', '2026-11-02T15:50:00+08:00',1,0,{ sessionCloseAt: '2026-11-02T16:08:23+08:00' }).end,'16:08:23')
})
test('周末、未知市场与无效系统时间不伪造未来截止时间', () => {
  assert.equal(povDeadlineText(end('SZ','2026-11-01T10:00:00+08:00')),'当日休市')
  assert.equal(povDeadlineText(end('unknown','2026-11-02T10:00:00+08:00')),'--')
  assert.equal(povDeadline({},1,0,new Date('bad')),null)
})


test('最大时长覆盖美股完整常规交易日，其他市场仍按收盘截断', () => {
  assert.equal(end('US', '2026-11-02T09:30:00-05:00',6,30).end,'16:00:00')
  assert.equal(end('HK', '2026-11-02T09:30:00+08:00',6,30).end,'16:10:00')
  assert.equal(end('SZ', '2026-11-02T09:30:00+08:00',6,30).end,'15:00:00')
})
