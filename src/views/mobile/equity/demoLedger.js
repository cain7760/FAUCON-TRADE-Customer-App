import { accounts, demoRecords } from './fixtures.js'
import { demoOrderCash, orderError, orderEstimates } from './orderModel.js'
import { createDemoOrder } from './orderActions.js'
import { currencyFor, frozenMargin, outstandingAmount, outstandingQuantity } from './orderCalculations.js'
import { demoCnyExchangeRates } from './positionCurrency.js'
import { decimalProduct, decimalSum, truncateDecimal } from './decimalMath.js'
import { formatOrderNumber, nextOrderNumber, orderNumberPrefix } from '../../../domain/orders/orderNumber.js'
import { marketClock } from '../../../domain/orders/marketSession.js'

export const demoLedgerStorageKey = 'faucon-customer-app-demo-orders-v1'
// 旧缓存的种子单可能来自更早的业务日；逐笔样例沿用其母单日期，避免伪装成今日新成交。
export function demoTradeRows(orders) {
  const parents = new Map(orders.map(row => [row.orderNo, row]))
  const parentsById = new Map(orders.map(row => [row.id, row]))
  return demoRecords.trades.flatMap(fill => {
    const parent = parentsById.get(fill.parentOrderId) || parents.get(fill.orderNo)
    if (!parent) return []
    const date = parent.orderTime.slice(0, 10)
    return [{ ...fill, orderNo: parent.orderNo, entrustNo: parent.orderNo, orderTime: parent.orderTime, tradeDate: date.replaceAll('-', ''),
      filledTime: date + fill.filledTime.slice(10), status: parent.status }]
  })
}
const copy = rows => rows.map(row => ({ ...row }))
const sum = (rows, value) => decimalSum(...rows.map(value))
const samePosition = (left, right) => left.account === right.account && left.code === right.code && left.market === right.market
const reservedCash = (rows, account) => sum(rows.filter(row => row.account === account && row.side === 'buy'), row => {
  const amount = outstandingAmount(row)
  return Number.isFinite(amount) ? decimalProduct(amount, demoCnyExchangeRates[currencyFor(row)] ?? 0) : 0
})
export function demoAvailableCash(orders, account) {
  // 初始余额是已扣除快照在途委托的可用余额，只计当前委托相对快照的增减，避免重复扣款。
  const openingCash = demoOrderCash[account]
  if (openingCash == null) return 0
  return Math.max(0, truncateDecimal(decimalSum(openingCash, reservedCash(demoRecords.orders, account), -reservedCash(orders, account)), 2))
}
export function demoLedgerError(orders) {
  for (const account of accounts) {
    if (decimalSum(demoOrderCash[account.id], reservedCash(demoRecords.orders, account.id), -reservedCash(orders, account.id)) < 0) return '委托占用超出可用资金'
  }
  for (const row of demoRecords.positions) {
    const reserved = rows => sum(rows.filter(order => samePosition(order, row) && order.side === 'sell'), outstandingQuantity)
    if (row.available + reserved(demoRecords.orders) - reserved(orders) < 0) return '委托数量超出最大可卖'
  }
  return ''
}
export function demoPositionRows(orders, positions = demoRecords.positions) {
  return positions.filter(row => Number.isFinite(Number(row.qty)) && Number(row.qty) > 0).map(row => {
    const reserved = rows => sum(rows.filter(order => samePosition(order, row) && order.side === 'sell'), outstandingQuantity)
    const todayBuys = (row.todayExecutions || []).filter(fill => fill.side === 'buy').reduce((total, fill) => total + fill.quantity, 0)
    const settled = Math.max(0, row.qty - (['SZ', 'SH', 'A', 'CN'].includes(row.market) ? todayBuys : 0))
    return { ...row, available: Math.max(0, Math.min(settled, row.available + reserved(demoRecords.orders) - reserved(orders))) }
  })
}
export function submitDemoOrder(orders, snapshot, now = new Date()) {
  if (!accounts.some(account => account.id === snapshot.account)) throw new Error('下单账户不存在')
  if (!demoCnyExchangeRates[currencyFor(snapshot.symbol)]) throw new Error('当前币种无可用汇率')
  const cash = demoAvailableCash(orders, snapshot.account)
  const position = demoPositionRows(orders).find(row => samePosition(row, { ...snapshot.symbol, account: snapshot.account }))
  const draft = { type: snapshot.type, price: snapshot.price, mode: 'quantity', value: snapshot.quantity, unit: 'shares', algorithm: snapshot.algorithmCode, pov: snapshot.pov }
  const estimate = orderEstimates(draft, snapshot.symbol, cash, position?.available)
  const error = orderError(draft, snapshot.symbol, estimate, snapshot.side)
  if (error) throw new Error(error)
  if (!snapshot.symbol.isManual && snapshot.side === 'buy' && snapshot.inputAmount != null
    && decimalProduct(snapshot.inputAmount, demoCnyExchangeRates[currencyFor(snapshot.symbol)]) > cash) throw new Error('订单金额超出可用资金')
  const number = nextOrderNumber(orders, snapshot.symbol.market, marketClock(now).date)
  const order = createDemoOrder(snapshot, Number(number.slice(-3)) - 1, now)
  orders.unshift(order)
  return order
}
function normalizeOrderNumbers(orders) {
  const rows = copy(orders), used = new Set(), changes = new Map(), pending = []
  const seeds = new Map(demoRecords.orders.map(row => [row.id, row]))
  for (const row of rows) {
    const number = String(row.orderNo)
    if (/^\d{18}$/.test(number) && number.startsWith(orderNumberPrefix(row.market, row.orderTime)) && number.slice(-3) !== '000' && !used.has(number)) {
      row.orderNo = number
      used.add(number)
    } else pending.push(row)
  }
  // 先给旧种子单保留既有序号，再为用户委托分配剩余编号；不改内部 ID、状态及数量。
  pending.sort((left, right) => Number(seeds.has(right.id)) - Number(seeds.has(left.id)))
  for (const row of pending) {
    const seed = seeds.get(row.id)
    const preferred = seed && formatOrderNumber(row.market, row.orderTime, Number(seed.orderNo.slice(-3)))
    const number = preferred && !used.has(preferred) ? preferred : nextOrderNumber([...used].map(orderNo => ({ orderNo })), row.market, row.orderTime)
    changes.set(String(row.orderNo), number)
    row.orderNo = number
    used.add(number)
  }
  const legacyPattern = [...changes.keys()].filter(Boolean).sort((a, b) => b.length - a.length).map(number => number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const legacyNumbers = legacyPattern ? new RegExp(legacyPattern, 'g') : null
  for (const row of rows) {
    for (const key of ['parentOrderNo', 'entrustNo']) if (row[key] != null && changes.has(String(row[key]))) row[key] = changes.get(String(row[key]))
    if (Array.isArray(row.history)) row.history = row.history.map(entry => {
      const updated = { ...entry }
      for (const key of ['content', 'detail', 'message']) if (legacyNumbers && typeof updated[key] === 'string') updated[key] = updated[key].replace(legacyNumbers, number => changes.get(number))
      return updated
    })
  }
  return rows
}
export function loadDemoOrders(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(demoLedgerStorageKey) || 'null')
    if (saved?.version === 1 && Array.isArray(saved.orders) && new Set(saved.orders.map(row => row.id)).size === saved.orders.length
      && saved.orders.every(row => row && typeof row.id === 'string' && accounts.some(account => account.id === row.account)
        && Number.isSafeInteger(row.quantity) && row.quantity > 0 && ['buy', 'sell'].includes(row.side))) {
      const existing = new Set(saved.orders.map(row => row.id))
      const addedSamples = demoRecords.orders.filter(row => row.demoStatusSample && !existing.has(row.id))
      const restored = [...saved.orders, ...addedSamples].map(row => ({ ...row, frozenMargin: frozenMargin(row) }))
      try { return normalizeOrderNumbers(restored) }
      catch { return restored } // 异常旧数据保留原记录，不以新样例覆盖用户操作。
    }
  } catch { /* 损坏或不可读的本地缓存不影响进入演示页面。 */ }
  return copy(demoRecords.orders)
}
export function saveDemoOrders(storage, orders) {
  try { storage.setItem(demoLedgerStorageKey, JSON.stringify({ version: 1, orders })); return true }
  catch { return false }
}
