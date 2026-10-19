// Customer PC 演示持仓口径：只用于界面演示，不代表实时持仓或成交回报。
// 来源：Customer PC 的 src/views/equity/fixtures.js 与 variantData.js
export const accounts = [
  { id: 'TZS_T0', name: '自营一号' },
  { id: 'TZS_T1', name: '自营二号' },
]

const instruments = [
  { code: '000001', name: '平安银行', market: 'SZ', cost: 11.70, price: 11.78, change: .68, opening: 9300 },
  { code: '002459', name: '晶澳科技', market: 'SZ', cost: 7.14, price: 6.92, change: -1.56, opening: 11000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 6.78 }, { side: 'buy', quantity: 2500, price: 7.14 }] },
  { code: '300008', name: '天海防务', market: 'SZ', cost: 6.30, price: 6.39, change: 1.27, opening: 25000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 6.48 }] },
  { code: '000020', name: '深华发 A', market: 'SZ', cost: 12.86, price: 13.70, change: 2.09, opening: 6000 },
  { code: '600036', name: '招商银行', market: 'SH', cost: 39.10, price: 38.85, change: -.46, opening: 7200, todayExecutions: [{ side: 'sell', quantity: 1000, price: 39.62 }, { side: 'buy', quantity: 2000, price: 39.10 }] },
  { code: '600519', name: '贵州茅台', market: 'SH', cost: 1432.60, price: 1456.00, change: .82, opening: 500 },
  { code: '000002', name: '万科 A', market: 'SZ', cost: 3.15, price: 3.27, change: .31, opening: 46100, todayExecutions: [{ side: 'sell', quantity: 2000, price: 3.03 }] },
  { code: '600030', name: '中信证券', market: 'SH', cost: 27.12, price: 26.48, change: -.75, opening: 14000, pendingSell: 1000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 27.28 }, { side: 'buy', quantity: 2000, price: 27.12 }] },
  { code: '300750', name: '宁德时代', market: 'SZ', cost: 182.90, price: 186.32, change: 1.16, opening: 1800 },
  { code: '601318', name: '中国平安', market: 'SH', cost: 49.20, price: 48.56, change: -.23, opening: 9000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 49.08 }] },
  { code: '600900', name: '长江电力', market: 'SH', cost: 27.85, price: 28.34, change: .53, opening: 17000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 27.93 }] },
  { code: '002594', name: '比亚迪', market: 'SZ', cost: 242.50, price: 245.80, change: 1.42, opening: 1400, pendingSell: 200, todayExecutions: [{ side: 'buy', quantity: 600, price: 242.50 }] },
]
const cents = value => Math.round(Number(value) * 100)
export function calculatePositionMetrics(position, isAStock = false) {
  const openingLots = position.openingLots || [{ quantity: position.opening, price: position.cost }]
  const opening = openingLots.reduce((total, lot) => total + lot.quantity, 0)
  const lots = openingLots.map(lot => ({ ...lot }))
  let qty = opening
  let todayBuys = 0
  let realizedCents = 0
  for (const execution of position.todayExecutions || []) {
    if (execution.side === 'buy') {
      lots.push({ quantity: execution.quantity, price: execution.price })
      qty += execution.quantity
      todayBuys += execution.quantity
      continue
    }
    let remaining = execution.quantity
    for (const lot of lots) {
      const matched = Math.min(lot.quantity, remaining)
      realizedCents += (cents(execution.price) - cents(lot.price)) * matched
      lot.quantity -= matched
      remaining -= matched
      if (!remaining) break
    }
    if (remaining) throw new RangeError(`演示持仓 ${position.code || ''} 的卖出数量超过 FIFO 持仓`)
    qty -= execution.quantity
  }
  return {
    opening,
    qty,
    available: qty - (position.pendingSell || 0) - (isAStock ? todayBuys : 0),
    dailyRealizedProfit: realizedCents / 100,
  }
}
const remarks = ['请按委托价格优先处理', '客户指定分批执行', '请关注盘中流动性']
const traderRemarks = ['已受理，正在处理', '建议分批成交', '已反馈可执行价格']
// 新增来源标签的独立 mock，非 PC 快照字段，也不由同标的订单反推。
// 生产环境须由持仓接口返回实际来源集合；空集合表示未知，不默认成系统单。
const mockPositionSources = {
  '000001': ['系统单'], '002459': ['系统单', '手工单'], '300008': ['手工单'],
  '000020': ['系统单'], '600036': ['系统单'], '600519': ['系统单', '手工单'],
  '000002': ['手工单'], '600030': ['系统单'], '300750': ['系统单'],
  '601318': ['系统单', '手工单'], '600900': ['系统单'], '002594': ['手工单'],
}
const basePositions = instruments.map((position, index) => {
  const metrics = calculatePositionMetrics(position, true) // 当前演示持仓均为 A 股多头。
  const value = cents(position.price) * metrics.qty / 100
  const floatingProfit = (cents(position.price) - cents(position.cost)) * metrics.qty / 100
  return {
    ...position, ...metrics, id: `T0-${index}`,
    direction: '多', currency: 'CNY', account: 'TZS_T0',
    sourceOrderTypes: [...mockPositionSources[position.code]],
    value, marginOccupied: metrics.qty * cents(position.cost) * .1 / 100, marginRate: 10,
    floatingProfit, totalProfit: floatingProfit + metrics.dailyRealizedProfit,
    orderRemark: index % 4 === 3 ? remarks[index % 3] : '',
    traderRemark: index % 4 === 3 ? traderRemarks[index % 3] : '',
  }
})

// 保留 PC 快照的第二账户演示口径；不是可用于生产的损益计算规则。
const positions = [...basePositions, ...basePositions.map(row => ({
  ...row, id: row.id.replace('T0', 'T1'), account: 'TZS_T1',
  opening: row.opening * 2, qty: row.qty * 2, available: row.available * 2,
  pendingSell: (row.pendingSell || 0) * 2,
  todayExecutions: row.todayExecutions?.map(execution => ({ ...execution, quantity: execution.quantity * 2 })),
  value: row.value * 2, marginOccupied: row.marginOccupied * 2,
  floatingProfit: row.floatingProfit * 2, dailyRealizedProfit: row.dailyRealizedProfit * 2, totalProfit: row.totalProfit * 2,
}))]

export const orderStatuses = ['未报', '待报', '已报', '待撤', '待撤［部成］', '部撒', '撤单', '部成', '全成', '被拒绝', '已报待改', '待改［部成］', '待确认', '审核中', '审核拒绝', '待改审核', '待改［部成］', '待改［未报］', '待确认［待审核］']
const statuses = ['撤单', '待撤', '全成', '部成', '已报', '部成', '已报待改', '被拒绝', '被拒绝', '未报', '待确认', '审核中', '待改审核', '全成', '待改［未报］', '待确认［待审核］']
const amountOrderIndices = new Set([2, 3, 6, 11])
const orders = statuses.map((status, index) => {
  const instrument = basePositions[index % basePositions.length]
  const quantity = index === 5 ? 2000000 : (index + 1) * 100
  const filledQuantity = status === '全成' ? quantity : status.includes('部成') ? Math.max(100, Math.floor(quantity / 2 / 100) * 100) : 0
  const price = index % 3 === 1 ? null : instrument.price
  const inputAmount = price !== null && amountOrderIndices.has(index) ? Number((price * quantity).toFixed(2)) : null
  const isManual = status === '被拒绝' ? index !== statuses.indexOf('被拒绝') : index % 4 === 3
  return {
    id: `seed-${index + 1}`, orderNo: `WT20260911${String(index + 1).padStart(3, '0')}`,
    code: instrument.code, name: instrument.name, market: instrument.market, currency: 'CNY',
    account: index < 10 || index % 3 !== 1 ? 'TZS_T0' : 'TZS_T1',
    orderType: isManual ? '手工单' : '系统单', algorithm: index % 3 === 0 ? 'POV' : 'DMA',
    type: price === null ? 'market' : 'limit', side: index % 2 ? 'sell' : 'buy', openClose: index % 3 ? '平' : '开',
    status, price, quantity, inputAmount, orderValueNumber: inputAmount ?? quantity,
    attribute: `${price === null ? '市价' : '限价'}·${inputAmount === null ? '数量' : '金额'}`,
    filledQuantity, filledPrice: filledQuantity ? instrument.price : null,
    reportQuantity: ['已报', '待撤', '待撤［部成］', '部成', '已报待改', '待改［部成］'].includes(status) ? quantity - filledQuantity : 0,
    canceledQuantity: status === '撤单' ? quantity - filledQuantity : 0,
    frozenMargin: ['撤单', '全成', '被拒绝', '审核拒绝'].includes(status) ? 0 : (price || instrument.price) * quantity * .4,
    marginRate: 40, orderTime: `2026-09-11 09:${String(30 + index).padStart(2, '0')}:00`,
    orderRemark: isManual ? remarks[index % 3] : '',
    traderRemark: status === '被拒绝' ? '拒绝原因：委托价格偏离当前市场价格，暂不具备执行条件。' : status === '全成' && isManual ? '成交结果已确认，回报已同步' : isManual ? traderRemarks[index % 3] : '',
    feedback: status === '审核拒绝' ? '审核未通过' : status === '被拒绝' ? '订单已被拒绝' : status.includes('部成') ? '部分成交回报已确认，剩余数量继续挂单' : status === '全成' ? '成交回报已确认' : '',
  }
})

// 明确的演示成交快照。生产环境必须读取真实成交回报，不能由订单状态推导。
const tradeSnapshots = [
  { orderNo: 'WT20260911003', filledQuantity: 300, filledPrice: 6.39, filledAmount: 1917, filledTime: '2026-09-11 10:14:20' },
  { orderNo: 'WT20260911004', filledQuantity: 200, filledPrice: 13.70, filledAmount: 2740, filledTime: '2026-09-11 10:15:21' },
  { orderNo: 'WT20260911006', filledQuantity: 1000000, filledPrice: 1456, filledAmount: 1456000000, filledTime: '2026-09-11 10:17:23' },
  { orderNo: 'WT20260911014', filledQuantity: 1400, filledPrice: 6.92, filledAmount: 9688, filledTime: '2026-09-11 10:25:31' },
]
const trades = tradeSnapshots.map(trade => ({
  ...orders.find(order => order.orderNo === trade.orderNo), ...trade,
  id: `${trade.orderNo}-trade`, tradeNo: `CJ${trade.orderNo.slice(2)}`,
  entrustNo: `${trade.orderNo}-01`, tradeDate: '20260911',
}))

export const demoRecords = { positions, orders, trades }
