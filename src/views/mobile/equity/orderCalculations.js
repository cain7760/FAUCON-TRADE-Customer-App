import { decimalProduct, decimalSum, truncateDecimal } from './decimalMath.js'

export const activeOrderStatuses = new Set(['待报', '已报', '待改', '待撤', '部成'])
export const currencyFor = row => row?.currency || ({ HK: 'HKD', US: 'USD' }[row?.market] || 'CNY')
export const pricePrecision = symbol => symbol?.market === 'HK' || symbol?.isConvertibleBond ? 3 : 2
export const orderNotional = (quantity, price) => truncateDecimal(decimalProduct(quantity, price), 2)
export function filledAmount(row) {
  if (!(Number(row.filledQuantity) > 0)) return null
  if (row.filledAmount != null && Number.isFinite(Number(row.filledAmount))) return Number(row.filledAmount)
  return Number(row.filledPrice) > 0 ? orderNotional(row.filledQuantity, row.filledPrice) : null
}
export function averageFillPrice(row) {
  const amount = filledAmount(row)
  return amount == null ? null : amount / Number(row.filledQuantity)
}
export function outstandingQuantity(row) {
  return activeOrderStatuses.has(row.status) ? Math.max(0, Number(row.quantity) - Number(row.filledQuantity || 0)) : 0
}
export function outstandingAmount(row) {
  if (!outstandingQuantity(row)) return 0
  // 金额单保留未使用的委托金额；数量单按未成交股数乘委托/参考价。
  return row.inputAmount != null ? Math.max(0, decimalSum(row.inputAmount, -(filledAmount(row) || 0)))
    : orderNotional(outstandingQuantity(row), row.price ?? row.referencePrice ?? row.estimatePrice)
}
export function frozenMargin(row) {
  if (row.side !== 'buy' || !activeOrderStatuses.has(row.status)) return 0
  const amount = outstandingAmount(row), rate = Number(row.marginRate)
  return Number.isFinite(amount) && Number.isFinite(rate) && rate >= 0 && rate <= 100
    ? truncateDecimal(decimalProduct(amount, rate, .01), 2) : 0
}
export const canceledValue = row => !['撤单', '部撤'].includes(row.status) ? null : row.inputAmount != null ? (row.canceledAmount || null) : (row.canceledQuantity || null)
