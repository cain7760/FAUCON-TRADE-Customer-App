import { orderTradingSession } from './marketSession.js'

export function isLunchBreak(row, now = new Date()) {
  const session = orderTradingSession(row, now)
  return !!session && session.windows.length > 1
    && session.time >= session.windows[0][1] && session.time < session.windows[1][0]
}
// 午休只受理申请；原数量、价格、成交、冻结及挂单数据保持不变。
export function deferLunchOperation(row, action, payload = {}, now = new Date(), mode = null) {
  if (mode === 'trading' || !isLunchBreak(row, now)) return false
  row.pendingLunchOperation = {
    action, payload: JSON.parse(JSON.stringify(payload)), previousStatus: row.status,
    date: orderTradingSession(row, now).date,
  }
  row.status = action === 'amend' ? '待改' : '待撤'
  row.feedback = `午间休市，${action === 'amend' ? '改单' : '撤单'}申请已受理，复市后处理`
  return true
}
export function flushLunchOperations(orders, apply, now = new Date(), mode = null) {
  if (mode === 'non-trading') return
  for (const row of [...orders]) {
    const pending = row.pendingLunchOperation
    if (!pending || !['待改', '待撤'].includes(row.status)) continue
    const session = orderTradingSession(row, now)
    if (!session || session.date !== pending.date) continue
    if (mode !== 'trading' && !session.windows.some(([start, end]) => session.time >= start && session.time < end)) continue
    const waitingStatus = row.status
    row.status = pending.previousStatus
    delete row.pendingLunchOperation
    try { apply(row, pending) }
    catch { row.status = waitingStatus; row.pendingLunchOperation = pending }
  }
}
