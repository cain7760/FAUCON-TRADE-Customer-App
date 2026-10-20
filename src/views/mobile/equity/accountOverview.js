import { demoOrderCash } from './orderModel.js'
import { demoCnyExchangeRates } from './positionCurrency.js'

// Customer EquityVariants 的独立演示概要余额，不参与下单容量或资金校验。
const demoRealtimeAvailable = Object.freeze({ TZS_T0: 1245527941.41, TZS_T1: 620800 })
export function orderAccountOverview(accountId, positions) {
  const rows = positions.filter(row => row.account === accountId)
  const total = field => Math.round(rows.reduce((sum, row) => sum + (Number(row[field]) || 0) * (demoCnyExchangeRates[row.currency] ?? 1), 0) * 100) / 100
  return { available: demoRealtimeAvailable[accountId] ?? demoOrderCash[accountId] ?? null,
    marketValue: total('value'), floatingProfit: total('floatingProfit') }
}
