import { decimalProduct, truncateDecimal } from './decimalMath.js'
// 与 Customer PC 的账户概要使用相同演示汇率；不是实时外汇行情。
export const demoCnyExchangeRates = Object.freeze({ CNY: 1, HKD: 0.92, USD: 7.18 })

// marginCurrency 可标明接口保证金已是 CNY，避免按标的币种重复换算。
export function positionMarginInCny(row, exchangeRates = demoCnyExchangeRates) {
  const currency = row.marginCurrency || row.currency || (row.market === 'HK' ? 'HKD' : row.market === 'US' ? 'USD' : 'CNY')
  const rate = currency === 'CNY' ? 1 : exchangeRates[currency]
  if (row.marginOccupied == null || rate == null) return null
  const amount = Number(row.marginOccupied)
  const exchangeRate = Number(rate)
  return Number.isFinite(amount) && Number.isFinite(exchangeRate) && exchangeRate > 0 ? truncateDecimal(decimalProduct(amount, exchangeRate), 2) : null
}
