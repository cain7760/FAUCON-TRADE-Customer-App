import { historyAccounts, historyToday, shiftHistoryDate } from './historyModel.js'
import { expireOrdersAtClose } from '../../domain/orders/marketSession.js'
import { formatOrderNumber } from '../../domain/orders/orderNumber.js'

// 往日演示样例；当日记录由权益订单源在查询时补入，不接管真实成交。
const symbols = [
  { code: '000001', name: '平安银行', market: 'SZ', currency: 'CNY', price: 11.78 },
  { code: '600036', name: '招商银行', market: 'SH', currency: 'CNY', price: 38.85 },
  { code: '00700', name: '腾讯控股', market: 'HK', currency: 'HKD', price: 416.2 },
  { code: '002594', name: '比亚迪', market: 'SZ', currency: 'CNY', price: 245.8 },
]
const statuses = ['全成', '部成', '部撤', '撤单', '拒单', '异常', '已报', '待改', '待撤', '未报', '待报', '全成']
export function createHistoryDemo(today = historyToday()) {
  const orders = [], trades = []
  for (let offset = 1; offset <= 90; offset++) {
    const date = shiftHistoryDate(today, -offset)
    if ([0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()) || offset % 3 === 0) continue
    statuses.forEach((status, index) => {
      const symbol = symbols[(index + offset) % symbols.length]
      const account = historyAccounts[(index + offset) % historyAccounts.length]
      const orderNo = formatOrderNumber(symbol.market, date, index + 1)
      const quantity = (index + 1) * 1000
      const filledQuantity = status === '全成' ? quantity : ['部成', '部撤'].includes(status) ? quantity / 2 : 0
      const canceledQuantity = status === '撤单' ? quantity : status === '部撤' ? quantity - filledQuantity : 0
      const order = { ...symbol, id: orderNo, orderNo, orderDate: date, orderTime: `10:${String(index + 10).padStart(2, '0')}:00`, status, quantity, inputAmount: index % 3 === 1 ? Math.round(symbol.price * 100) * quantity / 100 : null, side: index % 2 ? 'sell' : 'buy', openClose: index % 2 ? '平' : '开', type: symbol.market !== 'HK' && index % 4 === 3 ? 'market' : 'limit', account: account.id, accountLabel: `${account.id} - ${account.name}`, orderType: index % 3 ? '系统单' : '手工单', canceledQuantity, algorithm: index % 2 ? 'DMA' : 'POV', filledQuantity, filledPrice: filledQuantity ? symbol.price : null, filledAmount: Math.round(symbol.price * 100) * filledQuantity / 100, canceledValue: index % 3 === 1 ? Math.round(symbol.price * 100) * canceledQuantity / 100 : canceledQuantity, frozenMargin: 0, marginRate: 40, reportQuantity: ['拒单', '异常', '未报', '待报'].includes(status) ? 0 : quantity - filledQuantity - canceledQuantity, orderRemark: index % 3 ? '' : '分批执行，注意成交价格', feedback: status === '异常' ? '演示：交易通道回报超时' : status === '拒单' ? '演示：委托被拒绝' : '' }
      if (order.type === 'market') order.price = null
      orders.push(order)
      if (!filledQuantity) return
      // 同一订单可有两个成交编号；逐笔价格、数量、金额均独立记录，不以订单终态筛选。
      const firstQuantity = Math.floor(filledQuantity / 2 / 100) * 100
      const fills = firstQuantity ? [firstQuantity, filledQuantity - firstQuantity] : [filledQuantity]
      fills.forEach((size, fillIndex) => {
        const tradeNo = `CJ${date.replaceAll('-', '')}${String(index + 1).padStart(5, '0')}${fillIndex + 1}`
        trades.push({ ...order, entrustNo: orderNo, id: tradeNo, tradeNo, tradeDate: date, filledTime: `10:${String(index + 11).padStart(2, '0')}:${fillIndex ? '30' : '05'}`, filledQuantity: size, filledPrice: symbol.price, filledAmount: Math.round(symbol.price * 100) * size / 100 })
      })
    })
  }
  expireOrdersAtClose(orders, new Date(`${today}T00:00:00+08:00`))
  const statusesByOrder = new Map(orders.map(row => [row.orderNo, row.status]))
  for (const row of orders) row.canceledValue = row.inputAmount != null ? Number(row.canceledAmount || row.canceledValue || 0) : row.canceledQuantity
  for (const row of trades) row.status = statusesByOrder.get(row.orderNo)
  return { orders, trades }
}
