// 只负责盈亏展示符号；精度、分组及截断规则由原有格式化函数决定。
export function formatPnl(value, formatter) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '--'
  const amount = Number(value)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return sign + formatter(Math.abs(amount))
}
