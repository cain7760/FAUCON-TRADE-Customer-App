import { hongKongDemoInstruments } from './hongKongInstruments.js'
import { decimalProduct, decimalSum, truncateDecimal } from './decimalMath.js'
import { frozenMargin, orderNotional } from './orderCalculations.js'
import { marketClock } from '../../../domain/orders/marketSession.js'
import { orderStatuses } from './orderStatus.js'
import { formatOrderNumber } from '../../../domain/orders/orderNumber.js'

// Customer PC 演示持仓口径：只用于界面演示，不代表实时持仓或成交回报。
// 来源：Customer PC 的 src/views/equity/fixtures.js 与 variantData.js
export const accounts = [
  { id: 'TZS_T0', name: '自营一号' },
  { id: 'TZS_T1', name: '自营二号' },
  // 扩展账户选择列表的展示 mock；无持仓，演示可用余额为 0。
  { id: 'TZS_T2', name: '自营三号' },
  { id: 'TZS_T3', name: '自营四号' },
  { id: 'TZS_T4', name: '自营五号' },
  { id: 'TZS_T5', name: '自营六号' },
  { id: 'TZS_T6', name: '自营七号' },
  { id: 'TZS_T7', name: '自营八号' },
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
// 与 Customer variantData.marketInstruments 相同的演示搜索池。
// 搜索池独立于持仓，包含标准港股演示标的。
const marketNames = ['华远科技', '新城制造', '中原能源', '海岳医药', '智联电子', '云帆软件', '国泰材料', '远景通信', '华夏消费', '深港物流']
// 保留原型既有的 40% IA 演示口径，作为标的元数据读取；不代表实际交易参数。
export const orderInstruments = [...instruments, ...hongKongDemoInstruments, ...Array.from({ length: 220 }, (_, index) => {
  const serial = index + 1
  const market = serial % 10 === 0 ? 'HK' : serial % 2 ? 'SZ' : 'SH'
  const price = Number((6.5 + (serial * 1.73) % 183).toFixed(2))
  return { code: String(market === 'HK' ? 1000 + serial : 100000 + serial).padStart(market === 'HK' ? 5 : 6, '0'),
    name: `${marketNames[index % 10]} ${String(serial).padStart(3, '0')}`, market, currency: market === 'HK' ? 'HKD' : 'CNY', price, cost: Number((price * .97).toFixed(2)), change: 0, available: 0, qty: 0, lotSize: 100 }
})].map(instrument => {
  const digits = instrument.market === 'HK' ? 3 : 2
  const preClose = truncateDecimal(instrument.preClose ?? instrument.price / (1 + Number(instrument.change || 0) / 100), digits)
  return { iaRate: 40, ...instrument, preClose,
    change: preClose > 0 ? decimalSum(instrument.price, -preClose) / preClose * 100 : null }
})
export function calculatePositionMetrics(position, isAStock = false) {
  const openingLots = position.openingLots || [{ quantity: position.opening, price: position.cost }]
  const validLot = lot => Number.isSafeInteger(lot.quantity) && lot.quantity >= 0 && Number.isFinite(lot.price) && lot.price >= 0
  if (!openingLots.every(validLot)) throw new RangeError('期初持仓数量或成本无效')
  const opening = openingLots.reduce((total, lot) => total + lot.quantity, 0)
  if (!Number.isSafeInteger(opening) || !Number.isSafeInteger(position.pendingSell || 0) || (position.pendingSell || 0) < 0) throw new RangeError('持仓数量或在途卖出数量无效')
  const lots = openingLots.map(lot => ({ ...lot }))
  let qty = opening
  let todayBuys = 0
  let realizedProfit = 0
  for (const execution of position.todayExecutions || []) {
    if (!validLot(execution) || !['buy', 'sell'].includes(execution.side)) throw new RangeError('成交数量、价格或方向无效')
    if (execution.side === 'buy') {
      lots.push({ quantity: execution.quantity, price: execution.price })
      qty += execution.quantity
      todayBuys += execution.quantity
      continue
    }
    if (isAStock && execution.quantity > qty - todayBuys) throw new RangeError('A 股当日买入不可当日卖出')
    let remaining = execution.quantity
    for (const lot of lots) {
      const matched = Math.min(lot.quantity, remaining)
      realizedProfit = decimalSum(realizedProfit, decimalProduct(decimalSum(execution.price, -lot.price), matched))
      lot.quantity -= matched
      remaining -= matched
      if (!remaining) break
    }
    if (remaining) throw new RangeError(`演示持仓 ${position.code || ''} 的卖出数量超过 FIFO 持仓`)
    qty -= execution.quantity
  }
  const costAmount = decimalSum(...lots.map(lot => decimalProduct(lot.price, lot.quantity)))
  const hasQuote = Number.isFinite(position.price) && position.price >= 0
  const value = qty === 0 ? 0 : hasQuote ? orderNotional(position.price, qty) : null
  const floatingProfit = qty === 0 ? 0 : hasQuote ? truncateDecimal(decimalSum(decimalProduct(position.price, qty), -costAmount), 2) : null
  return {
    opening,
    qty,
    available: Math.max(0, qty - (position.pendingSell || 0) - (isAStock ? todayBuys : 0)),
    cost: qty ? costAmount / qty : 0, value, floatingProfit,
    marginOccupied: truncateDecimal(decimalProduct(costAmount, position.marginRate ?? 10, .01), 2),
    dailyRealizedProfit: truncateDecimal(realizedProfit, 2),
    totalProfit: floatingProfit == null ? null : truncateDecimal(decimalSum(floatingProfit, realizedProfit), 2),
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
  return {
    ...position, ...metrics, id: `T0-${index}`,
    direction: '多', currency: 'CNY', account: 'TZS_T0',
    sourceOrderTypes: [...mockPositionSources[position.code]],
    marginRate: 10,
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

// 新版补齐当前 4177 PC 快照元数据；不改旧版来源标签及原始记录。
// 对齐 Customer 端 variantData.js，不从 sourceOrderTypes 猜测执行类型。
export const focusPositions = positions.map((row, index) => {
  const sourceIndex = index % basePositions.length
  const executionType = sourceIndex % 4 === 3 ? 'highTouch' : 'lowTouch'
  return { ...row, executionType, orderType: executionType === 'highTouch' ? '手工单' : '系统单', algorithm: sourceIndex % 3 === 0 ? 'POV' : 'DMA', positionDate: '2026-09-18', lotSize: row.lotSize || 100 }
})

export { orderStatuses } from './orderStatus.js'
const statuses = ['撤单', '待撤', '全成', '部成', '已报', '部成', '待改', '拒单', '拒单', '未报', '待报', '待报', '待改', '全成', '待报', '异常']
const amountOrderIndices = new Set([2, 3, 6, 11])
// 稳定演示编号不变，日内样例日期随业务日更新；持久化的真实交互记录不重置。
const demoOrderDate = marketClock().date
const orders = statuses.map((status, index) => {
  const instrument = basePositions[index % basePositions.length]
  const quantity = index === 5 ? 2000000 : (index + 1) * 100
  const filledQuantity = status === '全成' ? quantity : status.includes('部成') ? Math.max(100, Math.floor(quantity / 2 / 100) * 100) : 0
  const price = index % 3 === 1 ? null : instrument.price
  const inputAmount = price !== null && amountOrderIndices.has(index) ? orderNotional(quantity, price) : null
  const isManual = status === '拒单' ? index !== statuses.indexOf('拒单') : index % 4 === 3
  return {
    id: `seed-${index + 1}`, orderNo: formatOrderNumber(instrument.market, demoOrderDate, index + 1),
    code: instrument.code, name: instrument.name, market: instrument.market, currency: 'CNY',
    account: index < 10 || index % 3 !== 1 ? 'TZS_T0' : 'TZS_T1',
    orderType: isManual ? '手工单' : '系统单', algorithm: index % 3 === 0 ? 'POV' : 'DMA',
    type: price === null ? 'market' : 'limit', side: index % 2 ? 'sell' : 'buy', openClose: index % 3 ? '平' : '开',
    status, price, quantity, inputAmount, orderValueNumber: inputAmount ?? quantity,
    attribute: `${price === null ? '市价' : '限价'}·${inputAmount === null ? '数量' : '金额'}`,
    filledQuantity, filledPrice: filledQuantity ? instrument.price : null,
    filledAmount: filledQuantity ? orderNotional(filledQuantity, instrument.price) : 0,
    referencePrice: instrument.price,
    reportQuantity: ['已报', '待改', '待撤', '部成'].includes(status) ? quantity - filledQuantity : 0,
    canceledQuantity: status === '撤单' ? quantity - filledQuantity : 0,
    marginRate: 40, orderTime: `${demoOrderDate} 09:${String(30 + index).padStart(2, '0')}:00`,
    orderRemark: isManual ? remarks[index % 3] : '',
    traderRemark: status === '拒单' ? '拒绝原因：委托价格偏离当前市场价格，暂不具备执行条件。' : status === '全成' && isManual ? '成交结果已确认，回报已同步' : isManual ? traderRemarks[index % 3] : '',
    feedback: status === '拒单' ? '订单已被拒绝' : status.includes('部成') ? '部分成交回报已确认，剩余数量继续挂单' : status === '全成' ? '成交回报已确认' : '',
  }
}).map(row => ({ ...row, frozenMargin: frozenMargin(row) }))

// 明确的演示成交快照。生产环境必须读取真实成交回报，不能由订单状态推导。
const tradeSnapshots = [
  { parentOrderId: 'seed-3', filledQuantity: 300, filledPrice: 6.39, filledAmount: 1917, filledTime: '2026-09-11 10:14:20' },
  { parentOrderId: 'seed-4', filledQuantity: 200, filledPrice: 13.70, filledAmount: 2740, filledTime: '2026-09-11 10:15:21' },
  { parentOrderId: 'seed-6', filledQuantity: 1000000, filledPrice: 1456, filledAmount: 1456000000, filledTime: '2026-09-11 10:17:23' },
  { parentOrderId: 'seed-14', filledQuantity: 1400, filledPrice: 6.92, filledAmount: 9688, filledTime: '2026-09-11 10:25:31' },
]
const trades = tradeSnapshots.map(trade => {
  const order = orders.find(order => order.id === trade.parentOrderId)
  return { ...order, ...trade,
  filledTime: demoOrderDate + trade.filledTime.slice(10),
  id: `${order.id}-trade`, tradeNo: `CJ${order.orderNo}`,
  entrustNo: order.orderNo, tradeDate: demoOrderDate.replaceAll('-', ''),
  }
})

// 固定状态样例：每个已有持仓账户、每种状态补 3 条，独立于用户新下单及收盘回报。
// 数量、金额和成交样例在同一处构造，避免状态与成交/撤单字段互相矛盾。
const statusSamples = accounts.slice(0, 2).flatMap((account, accountIndex) => orderStatuses.flatMap((status, statusIndex) =>
  Array.from({ length: 3 }, (_, variant) => {
    const instrument = basePositions[(statusIndex + variant) % 4]
    const quantity = 600 + variant * 200
    const filledQuantity = status === '全成' ? quantity : ['部成', '部撤'].includes(status) ? quantity / 2 : 0
    const canceledQuantity = ['撤单', '部撤'].includes(status) ? quantity - filledQuantity : 0
    const price = variant === 2 ? null : instrument.price
    const inputAmount = variant === 1 ? orderNotional(quantity, instrument.price) : null
    const row = {
      id: `status-sample-${account.id}-${statusIndex}-${variant}`,
      orderNo: formatOrderNumber(instrument.market, demoOrderDate, orders.length + accountIndex * orderStatuses.length * 3 + statusIndex * 3 + variant + 1),
      demoStatusSample: true, code: instrument.code, name: instrument.name, market: instrument.market,
      currency: 'CNY', account: account.id, status, quantity, price, inputAmount,
      orderValueNumber: inputAmount ?? quantity, referencePrice: instrument.price,
      type: price === null ? 'market' : 'limit', side: variant === 1 ? 'sell' : 'buy',
      openClose: variant === 1 ? '平' : '开', orderType: variant === 1 ? '手工单' : '系统单', algorithm: 'DMA',
      attribute: `${price === null ? '市价' : '限价'}·${inputAmount === null ? '数量' : '金额'}`,
      filledQuantity, filledPrice: filledQuantity ? instrument.price : null,
      filledAmount: orderNotional(filledQuantity, instrument.price), canceledQuantity,
      canceledAmount: inputAmount != null ? orderNotional(canceledQuantity, instrument.price) : 0,
      reportQuantity: ['已报', '待改', '待撤', '部成'].includes(status) ? quantity - filledQuantity : 0,
      marginRate: 40, orderTime: `${demoOrderDate} 10:${String(statusIndex).padStart(2, '0')}:00`,
      orderRemark: '', traderRemark: status === '拒单' ? '演示拒单：委托价格偏离允许范围' : '',
      feedback: status === '异常' ? '演示异常：等待人工处理' : '',
    }
    return { ...row, frozenMargin: frozenMargin(row) }
  }),
))
const sampleTrades = statusSamples.filter(row => row.filledQuantity > 0).map(row => ({
  ...row, id: `${row.id}-trade`, parentOrderId: row.id, tradeNo: `CJ-${row.orderNo}`, entrustNo: row.orderNo,
  tradeDate: demoOrderDate.replaceAll('-', ''), filledTime: row.orderTime.slice(0, -2) + '20',
}))

export const demoRecords = { positions, orders: [...orders, ...statusSamples], trades: [...trades, ...sampleTrades] }
