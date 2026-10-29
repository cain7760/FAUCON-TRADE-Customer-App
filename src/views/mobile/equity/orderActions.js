import { orderError, orderEstimates, validPov } from './orderModel.js'
import { normalizeOrderType, orderTypeError } from './orderMarketRules.js'
import { decimalProduct, decimalSum, quantityForAmount, truncateDecimal } from './decimalMath.js'
import { currencyFor, filledAmount, frozenMargin, orderNotional, outstandingAmount, pricePrecision } from './orderCalculations.js'
import { canConvertOrder, orderActionReason, remainingQuantity } from './orderStatus.js'
import { formatOrderNumber, nextOrderNumber } from '../../../domain/orders/orderNumber.js'
import { marketClock } from '../../../domain/orders/marketSession.js'
export { canConvertOrder, orderActionReason, remainingQuantity } from './orderStatus.js'

// 只生成待报委托；容量占用与本地保存由 demoLedger 管理，不模拟成交。
export function createDemoOrder(snapshot, sequence, now = new Date()) {
  const typeError = orderTypeError(snapshot.type, snapshot.symbol)
  if (typeError) throw new Error(typeError)
  const draft = { type: snapshot.type, price: snapshot.price, mode: 'quantity', value: snapshot.quantity, unit: 'shares', algorithm: snapshot.algorithmCode, pov: snapshot.pov }
  const estimate = orderEstimates(draft, snapshot.symbol, 0, 0)
  const error = orderError(draft, snapshot.symbol, { ...estimate, maxBuy: Number.MAX_SAFE_INTEGER, maxSell: Number.MAX_SAFE_INTEGER }, snapshot.side)
  if (error) throw new Error(error)
  if (!snapshot.account || !['buy', 'sell'].includes(snapshot.side)) throw new Error('下单账户或买卖方向无效')
  if (snapshot.inputAmount != null && (!Number.isFinite(Number(snapshot.inputAmount)) || Number(snapshot.inputAmount) < orderNotional(snapshot.quantity, estimate.price))) throw new Error('委托金额不足以覆盖订单数量')
  const orderNo = formatOrderNumber(snapshot.symbol.market, marketClock(now).date, sequence + 1)
  const row = {
    ...snapshot.symbol, id: orderNo, orderNo, account: snapshot.account, currency: currencyFor(snapshot.symbol),
    executionType: snapshot.execution, orderType: snapshot.execution === 'highTouch' ? '手工单' : '系统单',
    type: snapshot.type, side: snapshot.side, openClose: snapshot.openClose || '开',
    algorithm: snapshot.algorithmCode, algorithmParams: snapshot.algorithmCode === 'POV' ? { ...snapshot.pov } : null,
    price: snapshot.type === 'market' ? null : snapshot.price, quantity: snapshot.quantity,
    inputAmount: snapshot.inputAmount, orderValueNumber: snapshot.inputAmount ?? snapshot.quantity,
    attribute: `${snapshot.type === 'limit' ? '限价' : '市价'}·${snapshot.inputAmount == null ? '数量' : '金额'}`,
    referencePrice: estimate.price, estimate: orderNotional(snapshot.quantity, estimate.price),
    status: '待报', filledQuantity: 0, filledPrice: null, filledAmount: 0, reportQuantity: 0,
    canceledQuantity: 0, canceledAmount: 0, marginRate: snapshot.symbol.iaRate ?? null,
    orderTime: now.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false }),
    orderRemark: snapshot.note, traderRemark: '', feedback: '待报',
  }
  row.frozenMargin = frozenMargin(row)
  return row
}

// 与 Customer 端的状态门禁一致。仅处理页面内演示订单，不调用交易服务。
// 旧演示记录可能没有成交回报；仅为兼容该快照按原委托价估算，绝不按改单新价改写已成金额。
export const amendmentFilledAmount = row => filledAmount(row) ?? orderNotional(row.filledQuantity || 0, row.price || 0)
export function amendmentDraft(row, { pcParity = false } = {}) {
  const quantity = remainingQuantity(row)
  return {
    execution: row.orderType === '手工单' ? 'highTouch' : 'lowTouch', type: normalizeOrderType(row.type, row),
    price: row.price ?? '', mode: row.inputAmount != null && row.type !== 'market' ? 'amount' : 'quantity',
    value: row.inputAmount != null && row.type !== 'market' ? Math.max(0, decimalSum(row.inputAmount, -amendmentFilledAmount(row))) : quantity,
    unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: row.algorithm || 'none',
    pov: { hours: 1, minutes: 0, participation: 10, ...row.algorithmParams }, note: row.orderRemark || '',
  }
}
export function amendmentEstimate(draft, row, symbol, cash, { pcParity = false, totalAmount } = {}) {
  const estimate = orderEstimates(draft, symbol, cash, remainingQuantity(row))
  estimate.maxBuy = Math.max(remainingQuantity(row), estimate.maxBuy)
  if (pcParity && draft.mode === 'amount') {
    const quantity = quantityForAmount(decimalSum(totalAmount, -amendmentFilledAmount(row)), estimate.price, estimate.lot)
    estimate.buy = estimate.sell = quantity
    estimate.buyAmount = estimate.sellAmount = orderNotional(estimate.buy, estimate.price)
  }
  if (draft.mode === 'percentage') {
    estimate.buy = quantityForAmount(decimalProduct(estimate.maxBuy, draft.fraction, .01), 1, estimate.lot)
    estimate.buyAmount = orderNotional(estimate.buy, estimate.price)
  }
  return estimate
}
export function amendmentPayload(draft, row, estimate, { pcParity = false, totalAmount } = {}) {
  const unfilled = estimate[row.side]
  const quantity = Number(row.filledQuantity || 0) + unfilled
  return { orderId: row.id, type: draft.type, price: draft.type === 'market' ? null : estimate.price, quantity,
    inputAmount: draft.mode === 'amount' ? (pcParity ? Number(totalAmount) : decimalSum(amendmentFilledAmount(row), Number(draft.value))) : null,
    algorithm: draft.algorithm, algorithmParams: draft.algorithm === 'POV' ? { ...draft.pov } : null, note: draft.note.trim() }
}
export function amendmentError(draft, row, symbol, estimate, options = {}) {
  const reason = orderActionReason(row)
  if (reason) return reason
  if (draft.mode !== 'percentage' && draft.value === '') return '请输入未成交部分的数量或金额'
  // 部成订单允许未成交部分改为 0，表示仅撤回剩余部分。
  const isCancelRemainder = estimate[row.side] === 0 && Number(row.filledQuantity) > 0
  // 当前 PC 改单只限制卖方未成交量；买方容量用于滑块，不新增现金校验。
  const validationEstimate = options.pcParity && row.side === 'buy' ? { ...estimate, maxBuy: Number.MAX_SAFE_INTEGER } : estimate
  const message = orderError(draft, symbol, isCancelRemainder ? { ...validationEstimate, [row.side]: estimate.lot } : validationEstimate, row.side)
  if (message) return message
  if (draft.mode === 'amount' && options.pcParity && Number(options.totalAmount) < amendmentFilledAmount(row)) return '修改后的订单金额不得低于已成交金额'
  const next = amendmentPayload(draft, row, estimate, options)
  const originalOptions = { ...options, totalAmount: row.inputAmount ?? Number(row.quantity) * Number(row.price || 0) }
  const originalDraft = amendmentDraft(row, originalOptions)
  const original = amendmentPayload(originalDraft, row, amendmentEstimate(originalDraft, row, symbol, Infinity, originalOptions), originalOptions)
  if (next.quantity === original.quantity && next.price === original.price && next.type === original.type
    && next.inputAmount === original.inputAmount && next.algorithm === original.algorithm
    && JSON.stringify(next.algorithmParams) === JSON.stringify(original.algorithmParams) && next.note === original.note) return '请先修改订单参数'
  return ''
}
function appendHistory(row, action, message, time) {
  row.history = [...(row.history || []), { action, message, time }]
  row.feedback = message
}
export function applyDemoOrderAction(orders, id, action, payload = {}, now = new Date(), { pcParity = false } = {}) {
  const row = orders.find(order => order.id === id)
  if (!row) throw new Error('订单不存在，请关闭后重试')
  if (action === 'convert' ? !canConvertOrder(row) : orderActionReason(row, action === 'cancel' ? '撤单' : '改单')) throw new Error('订单状态已变化，当前不可执行此操作')
  const time = now.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
  const remaining = remainingQuantity(row)
  const remainingAmount = outstandingAmount(row)
  if (action === 'convert') {
    const previousFeedback = row.feedback || '系统拒绝'
    row.orderType = '手工单'; row.executionType = 'highTouch'; row.orderRemark = String(payload.note || '').trim().slice(0, 200)
    row.convertedToManualAt = time
    appendHistory(row, '转手工单', '已转为手工单，待交易员处理', time)
    row.feedback = `${previousFeedback}；${row.feedback}`
    return '已转为手工单，原订单编号和状态保留。'
  }
  if (action === 'cancel') {
    row.status = row.filledQuantity > 0 ? '部撤' : '撤单'
    row.canceledQuantity = remaining
    row.canceledAmount = row.inputAmount != null ? remainingAmount : orderNotional(remaining, row.price ?? row.referencePrice ?? 0)
    row.reportQuantity = 0; row.frozenMargin = 0
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
  if (!['limit', 'market'].includes(payload.type) || (payload.type === 'limit' && truncateDecimal(referencePrice, pricePrecision(row)) !== referencePrice)) throw new Error('订单价格类型或精度无效')
  if (!Number.isSafeInteger(Math.trunc(decimalProduct(nextQuantity, referencePrice, 100)))) throw new Error('订单金额超出安全计算范围')
  if (payload.inputAmount != null && (!Number.isFinite(Number(payload.inputAmount)) || Number(payload.inputAmount) < decimalSum(amendmentFilledAmount(row), orderNotional(nextQuantity - filled, referencePrice)))) throw new Error('委托金额不足以覆盖订单数量')
  if (nextQuantity % (row.lotSize || 100) !== 0) throw new Error('订单数量不符合每手股数要求')
  if (row.side === 'sell' && nextQuantity > row.quantity) throw new Error('改单数量超出最大可卖')
  if (!['DMA', 'POV', 'none'].includes(payload.algorithm) || (payload.algorithm === 'POV' && !validPov(payload.algorithmParams || {}))) throw new Error('执行算法参数无效')
  const originalQuantity = row.quantity, delta = nextQuantity - originalQuantity
  const nextRemaining = nextQuantity - filled
  // 分配失败必须发生在修改母单前，避免序列用尽时产生半次改单。
  const childOrderNo = (filled > 0 ? nextRemaining > 0 : delta > 0) ? nextOrderNumber(orders, row.market, time) : null
  const createChild = quantity => {
    const amount = payload.inputAmount == null ? null : decimalSum(payload.inputAmount, -(filled > 0 ? amendmentFilledAmount(row) : orderNotional(row.quantity, referencePrice)))
    const child = { ...row, id: childOrderNo, orderNo: childOrderNo, demoStatusSample: false,
      parentOrderNo: row.orderNo, orderTime: time, quantity, type: payload.type, price: payload.price,
      referencePrice, estimate: orderNotional(quantity, referencePrice),
      inputAmount: amount,
      orderValueNumber: amount ?? quantity,
      attribute: payload.type === 'market' ? '市价单' : '限价单', algorithm: payload.algorithm, algorithmParams: payload.algorithmParams,
      orderRemark: payload.note, status: '待报', filledQuantity: 0, filledPrice: null, filledAmount: 0, reportQuantity: 0,
      canceledQuantity: 0, canceledAmount: 0,
      history: [], feedback: '', traderRemark: '' }
    appendHistory(child, '改单生成', `由订单 ${row.orderNo} 生成`, time)
    child.frozenMargin = frozenMargin(child)
    orders.push(child)
    return child.orderNo
  }
  if (filled > 0) {
    row.canceledQuantity = remaining
    row.canceledAmount = row.inputAmount != null ? remainingAmount : orderNotional(remaining, row.price ?? referencePrice)
    row.reportQuantity = 0; row.frozenMargin = 0; row.status = '部撤'
    const childNo = nextRemaining > 0 ? createChild(nextRemaining) : null
    appendHistory(row, '改单', childNo ? `已撤回未成交部分，新订单 ${childNo}` : '已撤回全部未成交部分', time)
  } else {
    Object.assign(row, { type: payload.type, price: payload.price, algorithm: payload.algorithm, algorithmParams: payload.algorithmParams, orderRemark: payload.note,
      attribute: payload.type === 'market' ? '市价单' : '限价单', status: '待改', quantity: delta > 0 ? originalQuantity : nextQuantity })
    row.inputAmount = payload.inputAmount == null ? null : delta <= 0 ? Number(payload.inputAmount) : orderNotional(row.quantity, referencePrice)
    row.orderValueNumber = row.inputAmount ?? row.quantity
    row.referencePrice = referencePrice; row.estimate = orderNotional(row.quantity, referencePrice)
    row.reportQuantity = row.quantity; row.frozenMargin = frozenMargin(row)
    if (delta < 0) { row.canceledQuantity = Number(row.canceledQuantity || 0) - delta; row.canceledAmount = decimalSum(row.canceledAmount || 0, orderNotional(-delta, referencePrice)) }
    const childNo = delta > 0 ? createChild(delta) : null
    appendHistory(row, '改单', childNo ? `已更新订单参数，新增追单 ${childNo}` : delta < 0 ? '部撤完成，订单参数已更新' : '订单参数已更新', time)
  }
  return '改单已确认，已成交部分保持不变。'
}
