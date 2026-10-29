// 用十进制整数做中间运算，避免 1.13 * 100 或金额 / 单价在整手边界丢一手。
// 对外仍返回 Number；订单入口另行限制数量和金额必须在安全范围内。
function decimal(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null
  const match = String(value).trim().match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match || !(match[2] || match[3])) return null
  let scale = (match[3] || '').length - Number(match[4] || 0)
  let integer = BigInt(`${match[1]}${match[2] || '0'}${match[3] || ''}`)
  if (scale < 0) { integer *= 10n ** BigInt(-scale); scale = 0 }
  return { integer, scale }
}
const valueOf = ({ integer, scale }) => Number(`${integer}e-${scale}`)
export function truncateDecimal(value, digits = 2) {
  const part = decimal(value)
  if (!part) return NaN
  if (part.scale <= digits) return valueOf(part)
  return valueOf({ integer: part.integer / 10n ** BigInt(part.scale - digits), scale: digits })
}
export function decimalProduct(...values) {
  let integer = 1n, scale = 0
  for (const value of values) {
    const part = decimal(value)
    if (!part) return NaN
    integer *= part.integer; scale += part.scale
  }
  return valueOf({ integer, scale })
}
export function decimalSum(...values) {
  const parts = values.map(decimal)
  if (parts.some(part => !part)) return NaN
  const scale = Math.max(0, ...parts.map(part => part.scale))
  const integer = parts.reduce((sum, part) => sum + part.integer * 10n ** BigInt(scale - part.scale), 0n)
  return valueOf({ integer, scale })
}
export function quantityForAmount(amount, price, lot = 1) {
  const a = decimal(amount), p = decimal(price), l = decimal(lot)
  if (!a || !p || !l || a.integer < 0n || p.integer <= 0n || l.integer <= 0n) return 0
  const lots = a.integer * 10n ** BigInt(p.scale + l.scale) / (p.integer * l.integer * 10n ** BigInt(a.scale))
  return decimalProduct(Number(lots), lot)
}
