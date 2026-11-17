import { orderTradingSession } from './marketSession.js'

const minutes = value => /^\d{2}:\d{2}$/.test(value || '') && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN
const timeText = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
// 默认使用市场窗口，unrestricted 用于允许全天选时的 POV 参数。
export function executionTimeBounds(item, now = new Date(), marketHours = false, unrestricted = false) {
  const session = orderTradingSession(item, now)
  const clock = minutes(session?.time.slice(0, 5)) + (Number(session?.time.slice(6)) > 0 ? 1 : 0)
  if (unrestricted) return { clock, earliest: 0, windows: [[0, 24 * 60 - 1]] }
  const windows = (session?.windows || []).map(([from, to], index) => [
    index === 0 && !marketHours ? 9 * 60 + 15 : minutes(from.slice(0, 5)),
    marketHours ? minutes(to.slice(0, 5)) : Math.min(15 * 60, minutes(to.slice(0, 5))),
  ]).filter(([from, to]) => from < to)
  return { clock, earliest: Math.max(windows[0]?.[0] ?? 9 * 60 + 15, clock), windows }
}

export function executionTimeError(item, range, now = new Date(), marketHours = false, unrestricted = false) {
  if (!Array.isArray(range) || range.length !== 2 || range.some(value => !Number.isFinite(minutes(value)))) return '请选择开始和结束时间'
  const [start, end] = range.map(minutes)
  if (start >= end) return '结束时间须晚于开始时间'
  const { earliest, windows } = executionTimeBounds(item, now, marketHours, unrestricted)
  if (!windows.some(([from, to]) => start >= from && start < to)
    || !windows.some(([from, to]) => end > from && end <= to)) return marketHours ? '请选择标的市场的有效交易时段' : '请选择 09:15 至 15:00 范围内的有效交易时段'
  if (start < earliest) return '开始时间不可早于当前时间'
  return ''
}

// 快捷时长按有效交易分钟计算，跳过午休，最晚到当日收盘。
export function executionShortcut(item, shortcut, now = new Date(), delayMinutes = 3, marketHours = false, unrestricted = false) {
  const useFullDay = unrestricted && typeof shortcut === 'number'
  const { clock, windows } = executionTimeBounds(item, now, marketHours, useFullDay)
  const delayedStart = clock + delayMinutes
  const next = windows.find(([, end]) => delayedStart < end)
  if (!next) return null
  const start = Math.max(delayedStart, next[0])
  if (shortcut === 'morning') return windows.length > 1 && start < windows[0][1] ? [timeText(start), timeText(windows[0][1])] : null
  if (shortcut === 'close') return [timeText(start), timeText(windows.at(-1)[1])]
  let remaining = Number(shortcut)
  if (!Number.isFinite(remaining) || remaining <= 0) return null
  for (const [from, to] of windows) {
    const cursor = Math.max(start, from)
    if (cursor >= to) continue
    if (remaining <= to - cursor) return [timeText(start), timeText(cursor + remaining)]
    remaining -= to - cursor
  }
  return [timeText(start), timeText(windows.at(-1)[1])]
}

export function executionDurationMinutes(item, range, now = new Date(), marketHours = false, unrestricted = false) {
  if (!Array.isArray(range) || range.length !== 2) return 0
  const [start, end] = range.map(minutes)
  return executionTimeBounds(item, now, marketHours, unrestricted).windows.reduce((total, [from, to]) =>
    total + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0)
}
