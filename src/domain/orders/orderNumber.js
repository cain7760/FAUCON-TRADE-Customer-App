// 仅用于本地演示：市场 4 位 + 衍生品 900 + 日期 8 位 + 序号 3 位。
// 18 位编号超出 Number 安全整数范围，始终使用字符串。
const marketCodes = { A: '1000', CN: '1000', SH: '1000', SZ: '1000', BJ: '1000', HK: '2000', US: '3000' }
export function orderNumberPrefix(market, date) {
  const code = marketCodes[market]
  const day = String(date).slice(0, 10).replaceAll('-', '')
  const iso = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`
  if (!code || !/^\d{8}$/.test(day) || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) throw new Error('订单编号的市场或日期无效')
  return `${code}900${day}`
}
export function formatOrderNumber(market, date, sequence) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) throw new Error('当前市场当日订单序号已用尽（最多 999）')
  return orderNumberPrefix(market, date) + String(sequence).padStart(3, '0')
}
export function nextOrderNumber(orders, market, date) {
  const prefix = orderNumberPrefix(market, date)
  const used = new Set(orders.map(row => String(row.orderNo)))
  for (let sequence = 1; sequence <= 999; sequence++) {
    const number = prefix + String(sequence).padStart(3, '0')
    if (!used.has(number)) return number
  }
  throw new Error('当前市场当日订单序号已用尽（最多 999）')
}
