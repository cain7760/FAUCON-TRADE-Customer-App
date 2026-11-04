import { orderTradingSession } from './marketSession.js'

export const MAX_POV_HOURS = 6.5
export function isValidPovDuration(hours, minutes) {
  if (hours == null || minutes == null || hours === '' || minutes === '') return false
  const h = Number(hours), m = Number(minutes)
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && m >= 0 && m <= 59
    && h * 60 + m > 0 && h * 60 + m <= MAX_POV_HOURS * 60
}
const seconds = time => time.split(':').reduce((value, part) => value * 60 + Number(part), 0)
const timeText = value => [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map(part => String(part).padStart(2, '0')).join(':')

export function povDeadline(symbol, hours, minutes, now = new Date()) {
  if (!isValidPovDuration(hours, minutes)) return null
  const session = orderTradingSession(symbol, now)
  if (!session) return null
  if (!session.windows.length) return { ...session, state: 'closed-day', end: null }
  let remaining = (Number(hours) * 60 + Number(minutes)) * 60
  let cursor = seconds(session.time)
  const close = seconds(session.close)
  if (cursor >= close) return { ...session, state: 'closed', end: session.close }
  for (const [start, end] of session.windows) {
    const from = Math.max(cursor, seconds(start)), to = seconds(end)
    if (from >= to) continue
    if (remaining <= to - from) return { ...session, state: 'scheduled', end: timeText(from + remaining) }
    remaining -= to - from
    cursor = to
  }
  return { ...session, state: 'scheduled', end: session.close }
}

export function povDeadlineText(deadline) {
  if (!deadline) return '--'
  if (deadline.state === 'closed-day') return '当日休市'
  return deadline.end + (deadline.state === 'closed' ? '（已收盘）' : '')
}
