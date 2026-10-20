import { orderError, orderEstimates, validPov } from './orderModel.js'
import { normalizeOrderType, orderTypeError } from './orderMarketRules.js'

// Customer 普通下单的确认结果：只生成本页待报记录，不模拟成交或扣款。
export function createDemoOrder(snapshot, sequence, now = new Date()) {
  const typeError = orderTypeError(snapshot.type, snapshot.symbol)
  if (typeError) throw new Error(typeError)
  const orderNo = `DEMO${now.getTime()}${sequence}`
  return {
    ...snapshot.symbol, id: orderNo, orderNo, account: snapshot.account, currency: snapshot.symbol.currency || (snapshot.symbol.market === 'HK' ? 'HKD' : 'CNY'),
    executionType: snapshot.execution, orderType: snapshot.execution === 'highTouch' ? '手工单' : '系统单',
    type: snapshot.type, side: snapshot.side, openClose: snapshot.openClose || '开',
    algorithm: snapshot.algorithmCode, algorithmParams: snapshot.algorithmCode === 'POV' ? { ...snapshot.pov } : null,
    price: snapshot.type === 'market' ? null : snapshot.price, quantity: snapshot.quantity,
    inputAmount: snapshot.inputAmount, orderValueNumber: snapshot.inputAmount ?? snapshot.quantity,
    attribute: `${snapshot.type === 'limit' ? '限价' : '市价'}·${snapshot.inputAmount == null ? '数量' : '金额'}`,
    status: '待报', filledQuantity: 0, filledPrice: null, reportQuantity: snapshot.quantity,
    canceledQuantity: 0, canceledAmount: 0, marginRate: 40, frozenMargin: (snapshot.amount || 0) * .4,
    orderTime: now.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false }),
    orderRemark: snapshot.note, traderRemark: '', feedback: '待报',
  }
}

// 与 Customer 端的状态门禁一致。仅处理页面内演示订单，不调用交易服务。
export const remainingQuantity = row => Math.max(0, Number(row.quantity) - Number(row.filledQuantity || 0))
export const canConvertOrder = row => row.status === '被拒绝' && row.orderType === '系统单'
export function orderActionReason(row, action = '改单') {
  if (['部撒', '撤单', '全成', '被拒绝', '审核拒绝'].includes(row.status)) return `订单当前为${row.status}，终态订单不可${action}`
  if (!['待报', '已报', '部成'].includes(row.status)) return `订单当前为${row.status}，不可${action}`
  return remainingQuantity(row) > 0 ? '' : '订单无可操作数量'
}
export function amendmentDraft(row) {
  const quantity = remainingQuantity(row)
  return {
    execution: row.orderType === '手工单' ? 'highTouch' : 'lowTouch', type: normalizeOrderType(row.type, row),
    price: row.price ?? '', mode: row.inputAmount != null && row.type !== 'market' ? 'amount' : 'quantity',
    value: row.inputAmount != null && row.type !== 'market' ? quantity * Number(row.price || 0) : quantity,
    unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: row.algorithm || 'none',
    pov: { hours: 1, minutes: 0, participation: 10, ...row.algorithmParams }, note: row.orderRemark || '',
  }
}
export function amendmentEstimate(draft, row, symbol, cash) {
  const estimate = orderEstimates(draft, symbol, cash, remainingQuantity(row))
  estimate.maxBuy = Math.max(remainingQuantity(row), estimate.maxBuy)
  if (draft.mode === 'percentage') {
    estimate.buy = Math.floor(estimate.maxBuy * draft.fraction / 100 / estimate.lot) * estimate.lot
    estimate.buyAmount = estimate.buy * Math.round(estimate.price * 100) / 100
  }
  return estimate
}
export function amendmentPayload(draft, row, estimate) {
  const unfilled = estimate[row.side]
  const quantity = Number(row.filledQuantity || 0) + unfilled
  return { orderId: row.id, type: draft.type, price: draft.type === 'market' ? null : estimate.price, quantity,
    inputAmount: draft.mode === 'amount' ? Math.round(quantity * estimate.price * 100) / 100 : null,
    algorithm: draft.algorithm, algorithmParams: draft.algorithm === 'POV' ? { ...draft.pov } : null, note: draft.note.trim() }
}
export function amendmentError(draft, row, symbol, estimate) {
  const reason = orderActionReason(row)
  if (reason) return reason
  if (draft.mode !== 'percentage' && draft.value === '') return '请输入未成交部分的数量或金额'
  // 部成订单允许未成交部分改为 0，表示仅撤回剩余部分。
  const isCancelRemainder = estimate[row.side] === 0 && Number(row.filledQuantity) > 0
  const message = orderError(draft, symbol, isCancelRemainder ? { ...estimate, [row.side]: estimate.lot } : estimate, row.side)
  if (message) return message
  const next = amendmentPayload(draft, row, estimate)
  const original = amendmentPayload(amendmentDraft(row), row, amendmentEstimate(amendmentDraft(row), row, symbol, Infinity))
  if (next.quantity === original.quantity && next.price === original.price && next.type === original.type
    && next.inputAmount === original.inputAmount && next.algorithm === original.algorithm
    && JSON.stringify(next.algorithmParams) === JSON.stringify(original.algorithmParams) && next.note === original.note) return '请先修改订单参数'
  return ''
}
function appendHistory(row, action, message, time) {
  row.history = [...(row.history || []), { action, message, time }]
  row.feedback = message
}
export function applyDemoOrderAction(orders, id, action, payload = {}, now = new Date()) {
  const row = orders.find(order => order.id === id)
  if (!row) throw new Error('订单不存在，请关闭后重试')
  if (action === 'convert' ? !canConvertOrder(row) : orderActionReason(row, action === 'cancel' ? '撤单' : '改单')) throw new Error('订单状态已变化，当前不可执行此操作')
  const time = now.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
  const remaining = remainingQuantity(row)
  if (action === 'convert') {
    const previousFeedback = row.feedback || '系统拒绝'
    row.orderType = '手工单'; row.executionType = 'highTouch'; row.orderRemark = String(payload.note || '').trim().slice(0, 200)
    row.convertedToManualAt = time
    appendHistory(row, '转手工单', '已转为手工单，待交易员处理', time)
    row.feedback = `${previousFeedback}；${row.feedback}`
    return '已转为手工单，原订单编号和状态保留。'
  }
  if (action === 'cancel') {
    row.status = row.filledQuantity > 0 ? '部撒' : '撤单'
    row.canceledQuantity = remaining; row.reportQuantity = 0; row.frozenMargin = 0
    appendHistory(row, '撤单', '撤单成功，已成交部分不变', time)
    return '已撤回未成交部分，已成交部分保持不变。'
  }
  if (action !== 'amend') throw new Error('不支持的订单操作')
  const typeError = orderTypeError(payload.type, row)
  if (typeError) throw new Error(typeError)
  const filled = Number(row.filledQuantity || 0), nextQuantity = Number(payload.quantity)
  if (!Number.isSafeInteger(nextQuantity) || nextQuantity <= 0 || nextQuantity < filled) throw new Error('改单数量无效，不能少于已成交数量')
  const referencePrice = Number(payload.price ?? payload.referencePrice)
  if (!(referencePrice > 0) || !Number.isFinite(referencePrice)) throw new Error('订单参考价格无效')
  if (!['limit', 'market'].includes(payload.type) || (payload.type === 'limit' && Math.abs(referencePrice * 100 - Math.round(referencePrice * 100)) > 1e-6)) throw new Error('订单价格类型或精度无效')
  if (nextQuantity % (row.lotSize || 100) !== 0) throw new Error('订单数量不符合每手股数要求')
  if (row.side === 'sell' && nextQuantity > row.quantity) throw new Error('改单数量超出最大可卖')
  if (!['DMA', 'POV', 'none'].includes(payload.algorithm) || (payload.algorithm === 'POV' && !validPov(payload.algorithmParams || {}))) throw new Error('执行算法参数无效')
  const originalQuantity = row.quantity, delta = nextQuantity - originalQuantity
  const nextRemaining = nextQuantity - filled
  const createChild = quantity => {
    const child = { ...row, id: `demo-${now.getTime()}-${orders.length}`, orderNo: `DEMO${now.getTime()}${orders.length}`,
      parentOrderNo: row.orderNo, orderTime: time, quantity, type: payload.type, price: payload.price,
      inputAmount: payload.inputAmount == null ? null : Math.round(quantity * referencePrice * 100) / 100,
      orderValueNumber: payload.inputAmount == null ? quantity : Math.round(quantity * referencePrice * 100) / 100,
      attribute: payload.type === 'market' ? '市价单' : '限价单', algorithm: payload.algorithm, algorithmParams: payload.algorithmParams,
      orderRemark: payload.note, status: '待报', filledQuantity: 0, filledPrice: null, reportQuantity: quantity,
      canceledQuantity: 0, canceledAmount: 0, frozenMargin: referencePrice * quantity * (row.marginRate || 0) / 100,
      history: [], feedback: '', traderRemark: '' }
    appendHistory(child, '改单生成', `由订单 ${row.orderNo} 生成`, time)
    orders.push(child)
    return child.orderNo
  }
  if (filled > 0) {
    row.canceledQuantity = Number(row.canceledQuantity || 0) + remaining
    row.canceledAmount = Number(row.canceledAmount || 0) + remaining * Number(row.price ?? referencePrice)
    row.reportQuantity = 0; row.frozenMargin = 0; row.status = '部撒'
    const childNo = nextRemaining > 0 ? createChild(nextRemaining) : null
    appendHistory(row, '改单', childNo ? `已撤回未成交部分，新订单 ${childNo}` : '已撤回全部未成交部分', time)
  } else {
    Object.assign(row, { type: payload.type, price: payload.price, algorithm: payload.algorithm, algorithmParams: payload.algorithmParams, orderRemark: payload.note,
      attribute: payload.type === 'market' ? '市价单' : '限价单', status: '已报待改', quantity: delta > 0 ? originalQuantity : nextQuantity })
    row.inputAmount = payload.inputAmount == null ? null : Math.round(row.quantity * referencePrice * 100) / 100
    row.orderValueNumber = row.inputAmount ?? row.quantity
    row.reportQuantity = row.quantity; row.frozenMargin = referencePrice * row.quantity * (row.marginRate || 0) / 100
    if (delta < 0) { row.canceledQuantity = Number(row.canceledQuantity || 0) - delta; row.canceledAmount = Number(row.canceledAmount || 0) - delta * referencePrice }
    const childNo = delta > 0 ? createChild(delta) : null
    appendHistory(row, '改单', childNo ? `已更新订单参数，新增追单 ${childNo}` : delta < 0 ? '部撤完成，订单参数已更新' : '订单参数已更新', time)
  }
  return '改单已确认，已成交部分保持不变。'
}
