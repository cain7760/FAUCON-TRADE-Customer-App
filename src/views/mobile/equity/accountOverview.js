import { demoOrderCash } from './orderModel.js'
import { demoCnyExchangeRates } from './positionCurrency.js'
import { decimalProduct, decimalSum, truncateDecimal } from './decimalMath.js'

export function orderAccountOverview(accountId, positions, cashBalances = demoOrderCash) {
  const ids = [...new Set(Array.isArray(accountId) ? accountId : [accountId])]
  const rows = positions.filter(row => ids.includes(row.account))
  const total = field => {
    const values = rows.map(row => decimalProduct(row[field], demoCnyExchangeRates[row.currency || 'CNY']))
    return values.every(Number.isFinite) ? truncateDecimal(decimalSum(...values), 2) : null
  }
  const balances = ids.map(id => cashBalances[id]).filter(value => value != null)
  return { available: balances.length ? truncateDecimal(decimalSum(...balances), 2) : null,
    marketValue: total('value'), floatingProfit: total('floatingProfit') }
}
