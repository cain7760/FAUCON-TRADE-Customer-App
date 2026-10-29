// 把当日委托/逐笔成交适配为历史记录；每次捕获都深拷贝，禁止引用实时响应式行。
const copy = value => JSON.parse(JSON.stringify(value))
const day = value => {
  const text = String(value || '').slice(0, 10)
  return /^\d{8}$/.test(text) ? text.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : text
}
const time = value => String(value || '').slice(-8)
function orderRecord(row, accounts) {
  const filledQuantity = Number(row.filledQuantity || 0)
  const filledAmount = row.filledAmount ?? filledQuantity * Number(row.filledPrice || 0)
  const inputAmount = row.inputAmount ?? null
  return {
    ...row, orderDate: day(row.orderDate || row.orderTime), orderTime: time(row.orderTime),
    currency: row.currency || ({ HK: 'HKD', US: 'USD' }[row.market] || 'CNY'),
    accountLabel: row.accountLabel || accounts.find(account => account.id === row.account)?.label || (() => {
      const account = accounts.find(account => account.id === row.account)
      return account ? `${account.id} - ${account.name}` : row.account
    })(),
    inputAmount, filledQuantity, filledAmount,
    canceledValue: inputAmount != null ? Number(row.canceledAmount || 0) : Number(row.canceledQuantity || 0),
  }
}
export function captureHistoryRecords(archive, current = {}, accounts = []) {
  const orders = new Map(archive.orders.map(row => [row.orderNo, row]))
  for (const row of current.orders || []) orders.set(row.orderNo, orderRecord(row, accounts))
  const trades = new Map(archive.trades.map(row => [row.tradeNo, row]))
  for (const row of current.trades || []) {
    if (!row.tradeNo || !(Number(row.filledQuantity) > 0)) continue
    const parent = orders.get(row.orderNo)
    const normalized = orderRecord({ ...parent, ...row }, accounts)
    trades.set(row.tradeNo, { ...normalized, tradeDate: day(row.tradeDate || row.filledTime),
      filledTime: time(row.filledTime), entrustNo: row.entrustNo || row.orderNo })
  }
  // 成交按成交编号保留数量价格，仅关联最新的母单状态；绝不从订单终态虚构成交。
  const fills = [...trades.values()].map(row => ({ ...row, status: orders.get(row.orderNo)?.status ?? row.status }))
  return copy({ orders: [...orders.values()], trades: fills })
}
