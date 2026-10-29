import { normalizeOrderType, orderTypeError } from './orderMarketRules.js'
import { decimalProduct, decimalSum, quantityForAmount, truncateDecimal } from './decimalMath.js'
import { currencyFor, orderNotional, pricePrecision } from './orderCalculations.js'
import { demoCnyExchangeRates } from './positionCurrency.js'

// 与同级 Customer 端 OrderTicket.vue / orderAlgorithmDefaults.js 的普通权益单口径对齐。
// 仅供本地演示，不是生产风控或交易服务。
export const demoOrderCash = { TZS_T0: 945527.41, TZS_T1: 620800, TZS_T2: 0, TZS_T3: 0, TZS_T4: 0, TZS_T5: 0, TZS_T6: 0, TZS_T7: 0 }
export const largeOrderAmount = 8_000_000
export const algorithmOptions = [
  { value: 'POV', label: 'POV' },
  { value: 'DMA', label: 'DMA' },
  { value: 'none', label: '无需算法' },
]
export function defaultOrderAlgorithm(market, now = new Date()) {
  const cutoff = { A: 895, SH: 895, SZ: 895, HK: 955 }[market]
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]))
  return cutoff != null && Number(parts.hour) * 60 + Number(parts.minute) >= cutoff ? 'DMA' : 'POV'
}
export function validPov(parameters) {
  const { hours, minutes, participation } = parameters || {}
  return hours != null && minutes != null && participation != null
    && Number.isInteger(Number(hours)) && hours !== '' && hours >= 0 && hours <= 23
    && Number.isInteger(Number(minutes)) && minutes !== '' && minutes >= 0 && minutes <= 59
    && Number(hours) + Number(minutes) > 0
    && Number.isInteger(Number(participation)) && participation > 0 && participation <= 25
}
export function orderEstimates(draft, symbol, cash, available) {
  const rawPrice = Number(draft.type === 'market' ? symbol?.price : draft.price)
  const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0
  const lot = symbol?.isManual ? 1 : (Number.isSafeInteger(symbol?.lotSize) && symbol.lotSize > 0 ? symbol.lotSize : symbol?.market === 'US' ? 1 : 100)
  const fx = demoCnyExchangeRates[currencyFor(symbol)]
  const cashInCny = Number.isFinite(Number(cash)) && Number(cash) >= 0 && fx > 0 ? Number(cash) : 0
  const capacity = symbol && price > 0 ? quantityForAmount(cashInCny, decimalProduct(price, fx), lot) : 0
  const maxBuy = symbol?.isManual ? Number.MAX_SAFE_INTEGER : Number.isSafeInteger(capacity) ? capacity : 0
  const maxSell = symbol?.isManual ? Number.MAX_SAFE_INTEGER : symbol && Number.isSafeInteger(Number(available)) ? Math.max(0, Number(available)) : 0
  const inputAmount = Number(draft.value)
  const quantity = draft.mode === 'amount'
    ? (price > 0 && !symbol?.isManual ? quantityForAmount(inputAmount, price, lot) : 0)
    : decimalProduct(draft.value, draft.unit === 'wan' ? 10000 : 1)
  const byPercent = maximum => quantityForAmount(decimalProduct(maximum, draft.fraction, .01), 1, lot)
  const buy = draft.mode === 'percentage' ? byPercent(maxBuy) : quantity
  const sell = draft.mode === 'percentage' ? byPercent(maxSell) : quantity
  return { price, lot, maxBuy, maxSell, buy, sell, inputAmount, buyAmount: orderNotional(buy, price), sellAmount: orderNotional(sell, price) }
}
export function orderError(draft, symbol, estimate, side) {
  if (!symbol) return '请先选择下单标的'
  const typeError = orderTypeError(draft.type, symbol)
  if (typeError) return typeError
  if ((!Number.isFinite(estimate.price) || estimate.price <= 0) && !(symbol.isManual && draft.type === 'market')) return draft.type === 'market' ? '当前标的无参考行情，请使用限价' : '订单价格须大于 0'
  if (!['limit', 'market'].includes(draft.type)) return '订单价格类型无效'
  if (draft.type === 'limit' && truncateDecimal(estimate.price, pricePrecision(symbol)) !== estimate.price) return `订单价格最多保留${pricePrecision(symbol) === 3 ? '三' : '两'}位小数`
  if (!['quantity', 'amount', 'percentage'].includes(draft.mode)) return '订单数量模式无效'
  if (draft.mode === 'percentage' && !(Number.isFinite(Number(draft.fraction)) && draft.fraction > 0 && draft.fraction <= 100)) return '下单比例必须大于 0 且不超过 100%'
  if (draft.mode === 'quantity' && !Number.isInteger(decimalProduct(draft.value, draft.unit === 'wan' ? 10000 : 1))) return '订单数量请输入整数'
  if (draft.algorithm === 'POV' && !validPov(draft.pov)) return '请检查 POV 运行时间和市场成交占比'
  if (!algorithmOptions.some(option => option.value === draft.algorithm)) return '执行算法无效'
  const quantity = estimate[side]
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return '请输入有效的订单数量'
  if (!Number.isSafeInteger(Math.trunc(decimalProduct(quantity, estimate.price, 100)))) return '订单金额超出安全计算范围'
  if (quantity % estimate.lot !== 0) return `订单数量须为 ${estimate.lot} 股的整数倍`
  if (!symbol.isManual && quantity > (side === 'buy' ? estimate.maxBuy : estimate.maxSell)) return `当前订单数量超出最大可${side === 'buy' ? '买' : '卖'}，请重新输入`
  return ''
}
// Customer 按钮先校验参数，容量超限在点击预览时提示，不静默禁用。
export function canPreviewOrder(draft, symbol, estimate, side) {
  return !orderError(draft, symbol, { ...estimate, maxBuy: Number.MAX_SAFE_INTEGER, maxSell: Number.MAX_SAFE_INTEGER }, side)
}

// 与 Customer 的 watch 语义一致：重复点击当前选项不清空输入。
export function resetOrderSize(draft) {
  draft.value = ''; draft.fraction = 0
  if (draft.mode === 'percentage') draft.mode = 'quantity'
}
export function changeOrderType(draft, type, symbol) {
  type = normalizeOrderType(type, symbol)
  if (draft.type === type) return
  draft.type = type
  if (type === 'market') draft.mode = 'quantity'
  resetOrderSize(draft)
}
export function changeOrderMode(draft, mode) {
  if (draft.mode === mode) return
  draft.mode = mode; resetOrderSize(draft)
}
export function applyBookPrice(draft, price) {
  if (!(Number.isFinite(price) && price > 0)) return
  changeOrderType(draft, 'limit')
  draft.price = price
  if (draft.mode !== 'percentage') draft.fraction = 0
}

// Customer OrderBook 的确定性演示档位；不是实时行情。
export function orderBookLevels(symbol, depth = 10) {
  if (!symbol?.code || !Number.isFinite(Number(symbol.price)) || !(Number(symbol.price) > 0) || symbol.isManual) return []
  return Array.from({ length: depth === 5 ? 5 : 10 }, (_, index) => {
    const rank = index + 1
    const tick = 10 ** -pricePrecision(symbol)
    return { rank, bid: Math.max(tick, decimalSum(symbol.price, -decimalProduct(index, tick))), bidQuantity: rank * 6500 + 1800,
      ask: decimalSum(symbol.price, decimalProduct(rank, tick)), askQuantity: rank * 7800 + 1200 }
  })
}
