// 仅用于本地演示订单。生产撤单必须由服务端按交易所日历和交易回报执行。
const sessions = {
  A: { timeZone: 'Asia/Shanghai', close: '15:00:00' },
  HK: { timeZone: 'Asia/Hong_Kong', close: '16:10:00' },
  US: { timeZone: 'America/New_York', close: '16:00:00' },
}
// 港股 CAS 随机收市，未接行情时取结束上限；接口可用 sessionCloseAt 覆盖。
const specialCloses = {
  HK: { '2026-02-16': '12:10:00', '2026-12-24': '12:10:00', '2026-12-31': '12:10:00' },
  US: { '2026-11-27': '13:00:00', '2026-12-24': '13:00:00' },
}
// 来源：HKEX CT/075/25；NYSE 2026 hours-calendars。其他年份及临时休市由接口覆盖。
const activeStatuses = new Set(['未报', '待报', '已报', '待改', '待撤', '部成', '异常'])
const formatters = new Map()
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export function orderMarket(row) {
  const market = String(row.market || String(row.code || '').split('.').at(-1)).toUpperCase()
  if (['A', 'CN', 'SH', 'SZ', 'BJ', 'SSE', 'SZSE'].includes(market)) return 'A'
  if (['HK', 'HKEX', 'XHKG'].includes(market)) return 'HK'
  if (['US', 'NYSE', 'NASDAQ', 'AMEX'].includes(market)) return 'US'
  return null
}
export function marketClock(now = new Date(), market = 'A') {
  const timeZone = sessions[market]?.timeZone
  if (!timeZone || !Number.isFinite(now.getTime())) return null
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }))
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(now).map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` }
}
function sessionDate(row, market) {
  if (validDate(row.tradingDate)) return row.tradingDate
  // 旧委托时间沿用系统的上海业务时区；含偏移的 ISO 时间按真实瞬间换算。
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(row.orderTime || '')) {
    const time = row.orderTime.replace(' ', 'T')
    const date = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(time) ? time : time + '+08:00')
    return marketClock(date, market)?.date
  }
  return validDate(row.orderDate) ? row.orderDate : null
}
export function hasOrderSessionClosed(row, now = new Date()) {
  const market = orderMarket(row), clock = marketClock(now, market)
  if (!clock) return false
  // 交易服务传入的实际收市瞬间优先，涵盖随机竞价、临时休市与特殊交易日。
  if (row.sessionCloseAt) {
    if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(row.sessionCloseAt)) return false
    const close = Date.parse(row.sessionCloseAt)
    return Number.isFinite(close) && now.getTime() >= close
  }
  const date = sessionDate(row, market)
  if (!date) return false
  const close = specialCloses[market]?.[date] || sessions[market].close
  return clock.date > date || (clock.date === date && clock.time >= close)
}
const cents = value => Math.round((Number(value) + Number.EPSILON) * 100)
export function expireOrdersAtClose(orders, now = new Date()) {
  const changed = []
  for (const row of orders) {
    // 固定状态展示样例不接收自动收盘回报，用户新下单不带此标识。
    if (row.demoStatusSample) continue
    const quantity = Number(row.quantity), filled = Number(row.filledQuantity || 0)
    if (!activeStatuses.has(row.status) || !Number.isSafeInteger(quantity) || !Number.isSafeInteger(filled)
      || filled < 0 || filled >= quantity || !hasOrderSessionClosed(row, now)) continue
    const remaining = quantity - filled
    row.canceledQuantity = Number(row.canceledQuantity || 0) + remaining
    if (row.inputAmount != null) {
      const filledAmount = row.filledAmount ?? filled * Number(row.filledPrice || 0)
      row.canceledAmount = (cents(row.canceledAmount || 0) + Math.max(0, cents(row.inputAmount) - cents(filledAmount))) / 100
    }
    row.status = filled > 0 ? '部撤' : '撤单'
    row.reportQuantity = 0
    row.frozenMargin = 0
    row.autoCanceledAt = now.toISOString()
    row.feedback = filled > 0 ? '收盘自动撤单，未成交部分已撤回' : '收盘自动撤单'
    changed.push(row.id)
  }
  return changed
}
