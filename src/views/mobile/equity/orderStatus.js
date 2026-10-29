// 对齐 Customer Web EquityVariants.vue 的状态字典、orderStatusVisual 和操作门禁。
export const orderStatuses = ['未报', '待报', '已报', '待改', '待撤', '部撤', '撤单', '部成', '全成', '拒单', '异常']
export function orderStatusVisual(status) {
  if (status === '异常') return { tone: 'exception', path: 'M8 2.5 14 13H2L8 2.5Zm0 3.5v3m0 2v.5' }
  if (['部撤', '撤单'].includes(status)) return { tone: 'draft', path: 'M4 4l8 8M12 4 4 12' }
  if (status === '全成') return { tone: 'success', path: 'm3.5 8 2.8 2.8L12.5 5' }
  if (status === '部成') return { tone: 'partial', path: 'M8 3a5 5 0 1 0 5 5H8z' }
  if (status === '已报') return { tone: 'reported', path: 'M8 12V4M5 7l3-3 3 3M4 12v1h8v-1' }
  if (['未报', '待报', '待撤'].includes(status)) return { tone: 'pending', path: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3m0 2.5V8l2 1.5' }
  if (status === '拒单') return { tone: 'rejected', path: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3Zm-2 3 4 4m0-4-4 4' }
  if (status === '待改') return { tone: 'review', path: 'm4 12 1.2-3.3L10.8 3l2.2 2.2-5.7 5.7L4 12Zm5.3-8 2.2 2.2' }
  return { tone: 'draft', path: 'M4 4.5h3v3H4v-3Zm5 0h3v3H9v-3ZM4 9h3v3H4V9Zm5 0h3v3H9V9Z' }
}
export const remainingQuantity = row => Math.max(0, Number(row.quantity) - Number(row.filledQuantity || 0))
export const canConvertOrder = (row, systemRunning = true) => systemRunning && row.status === '异常' && row.orderType === '系统单'
export function orderActionReason(row, action = '改单', systemRunning = true) {
  if (!systemRunning) return '系统已暂停交易'
  if (['部撤', '撤单', '全成', '拒单'].includes(row.status)) return `订单当前为${row.status}，终态订单不可${action}`
  if (!['待报', '已报', '部成'].includes(row.status)) return `订单当前为${row.status}，不可${action}`
  return remainingQuantity(row) > 0 ? '' : '订单无可操作数量'
}
export function orderRowActions(row, systemRunning = true) {
  if (canConvertOrder(row, systemRunning)) return [{ key: 'convert', label: '转手工单', text: '转', disabled: false, reason: '' }]
  return [['amend', '修改订单', '改'], ['cancel', '撤单', '撤']].map(([key, label, text]) => {
    const reason = orderActionReason(row, label, systemRunning)
    return { key, label, text, reason, disabled: !!reason }
  })
}
