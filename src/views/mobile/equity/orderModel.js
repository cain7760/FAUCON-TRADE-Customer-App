import { orderTypeError } from './orderMarketRules.js'

// 与同级 Customer 端 OrderTicket.vue / orderAlgorithmDefaults.js 的普通权益单口径对齐。
// 仅供本地演示，不是生产风控或交易服务。
export const demoOrderCash = { TZS_T0: 945527.41, TZS_T1: 620800 }
export const largeOrderAmount = 8_000_000
export const algorithmOptions = [
  { value: 'POV', label: 'POV', description: '按市场成交占比执行' },
  { value: 'DMA', label: 'DMA', description: 'Direct Market Access' },
  { value: 'none', label: '无需算法', description: '不使用执行算法' },
]
export function defaultOrderAlgorithm(market, now = new Date()) {
  const cutoff = { A: 895, SH: 895, SZ: 895, HK: 955 }[market]
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]))
  return cutoff != null && Number(parts.hour) * 60 + Number(parts.minute) >= cutoff ? 'DMA' : 'POV'
}
export function validPov({ hours, minutes, participation }) {
  return Number.isInteger(Number(hours)) && hours !== '' && hours >= 0 && hours <= 23
    && Number.isInteger(Number(minutes)) && minutes !== '' && minutes >= 0 && minutes <= 59
    && Number(hours) + Number(minutes) > 0
    && Number.isInteger(Number(participation)) && participation > 0 && participation <= 25
}
export function orderEstimates(draft, symbol, cash, available) {
  const price = Number(draft.type === 'market' ? symbol?.price : draft.price) || 0
  const lot = symbol?.isManual ? 1 : (symbol?.lotSize || 100)
  const maxBuy = symbol && price > 0 ? Math.floor(cash / price / lot) * lot : 0
  const maxSell = symbol ? Math.max(0, Number(available) || 0) : 0
  const inputAmount = Number(draft.value)
  const quantity = draft.mode === 'amount'
    ? (price > 0 ? Math.floor(inputAmount / price / lot) * lot : 0)
    : Number(draft.value) * (draft.unit === 'wan' ? 10000 : 1)
  const byPercent = maximum => Math.floor(maximum * draft.fraction / 100 / lot) * lot
  const buy = draft.mode === 'percentage' ? byPercent(maxBuy) : quantity
  const sell = draft.mode === 'percentage' ? byPercent(maxSell) : quantity
  // 先转分再乘整数股数，避免 11.79 * 20000 在截断展示时变成 235799.99。
  const priceCents = Math.round(price * 100)
  return { price, lot, maxBuy, maxSell, buy, sell, inputAmount, buyAmount: buy * priceCents / 100, sellAmount: sell * priceCents / 100 }
}
export function orderError(draft, symbol, estimate, side) {
  if (!symbol) return '请先选择下单标的'
  const typeError = orderTypeError(draft.type, symbol)
  if (typeError) return typeError
  if (!Number.isFinite(estimate.price) || estimate.price <= 0) return draft.type === 'market' ? '当前标的无参考行情，请使用限价' : '订单价格须大于 0'
  if (draft.type === 'limit' && Math.abs(estimate.price * 100 - Math.round(estimate.price * 100)) > 1e-6) return '订单价格最多保留两位小数'
  if (draft.mode === 'quantity' && !Number.isInteger(Number(draft.value))) return '订单数量请输入整数'
  if (draft.algorithm === 'POV' && !validPov(draft.pov)) return '请检查 POV 运行时间和市场成交占比'
  const quantity = estimate[side]
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return '请输入有效的订单数量'
  if (quantity % estimate.lot !== 0) return `订单数量须为 ${estimate.lot} 股的整数倍`
  if (!symbol.isManual && quantity > (side === 'buy' ? estimate.maxBuy : estimate.maxSell)) return `当前订单数量超出最大可${side === 'buy' ? '买' : '卖'}，请重新输入`
  return ''
}
