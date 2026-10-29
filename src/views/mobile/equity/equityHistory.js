import { formatNumber } from './model.js'

// 对齐当前 Customer PC OrderHistoryDialog 的演示记录生成规则。
// 这些回退项不是交易服务日志；接入真实服务后应直接传入 history。
const quantity = value => formatNumber(value, 3, false)
const recordTime = row => row.orderTime || `${row.positionDate || '2026-09-18'} 09:30:00`

function offsetTime(time, seconds) {
  const date = new Date(String(time).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return time
  date.setSeconds(date.getSeconds() + seconds)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function historyOperator(label) {
  if (String(label).includes('客户')) return '客户'
  if (String(label).includes('审批')) return '审批人'
  return '交易员'
}

function statusRecord(row, time) {
  const status = row.status || '待报'
  if (status === '全成') return { operator: '交易所', time, type: status, content: `订单已全部成交，成交数量 ${quantity(row.filledQuantity || row.quantity)} 股。` }
  if (status === '部成') return { operator: '交易所', time, type: status, content: `订单已部分成交，成交数量 ${quantity(row.filledQuantity || 0)} 股。` }
  if (status === '部撤' || status === '撤单') return { operator: '当前账户', time, type: status, content: row.feedback || '订单撤单结果已确认。' }
  if (status === '拒单') return { operator: '交易员', time, type: status, content: row.traderRemark || row.feedback || '订单未获通过。' }
  return { operator: '交易员', time, type: status, content: row.feedback || `订单状态更新为${status}。` }
}

export function equityHistorySource(row) {
  if (!row) return 'empty'
  return Array.isArray(row.history) && row.history.length ? 'provided' : 'demo'
}

export function buildEquityHistory(row, kind = 'orders') {
  if (!row) return []
  if (Array.isArray(row.history) && row.history.length) {
    return row.history.map(item => ({
      // 同时读取 PC 历史字段与原 App 本地操作历史，不改变原始记录。
      operator: item.operator || (item.label ? historyOperator(item.label) : '当前账户'),
      // 已有日志缺时间时显示未知，不用快照日期伪造该事件的发生时点。
      time: item.at || item.time || '--',
      type: item.label || item.action || item.type || '状态更新',
      content: item.detail || item.message || item.content || '订单状态已更新。',
    })).sort((a, b) => String(b.time).localeCompare(String(a.time)))
  }
  const direction = row.side === 'sell' ? '卖出' : '买入'
  const openClose = row.openClose === '平' ? '平仓' : '开仓'
  const recordQuantity = kind === 'positions' ? row.quantity ?? row.qty : row.quantity
  const value = row.inputAmount != null ? `${formatNumber(row.inputAmount)} CNY` : `${quantity(recordQuantity || 0)} 股`
  const entries = [{ operator: '当前账户', time: recordTime(row), type: '下单', content: `提交${direction}${openClose}${row.type === 'market' ? '市价' : '限价'}订单：${value}。` }]
  let offset = 45
  if (row.orderType === '手工单') {
    entries.push({ operator: '交易员', time: offsetTime(recordTime(row), offset), type: '受理', content: '已接收手工单，等待交易员处理。' })
    offset += 45
  }
  entries.push(statusRecord(row, offsetTime(recordTime(row), offset)))
  if (row.convertedToManualAt) entries.push({ operator: '当前账户', time: row.convertedToManualAt, type: '转手工单', content: row.orderRemark ? `已转为手工单；下单备注：${row.orderRemark}` : '被拒绝系统单已转为手工单，等待交易员处理。' })
  return entries.sort((a, b) => String(b.time).localeCompare(String(a.time)))
}

export function equityHistoryCsv(records) {
  const rows = [['操作人', '操作时间', '操作类型', '操作内容'], ...records.map(item => [item.operator, item.time, item.type, item.content])]
  // CSV 供电子表格打开；文本字段中的公式前缀不能变成可执行公式。
  const cell = value => {
    const text = String(value ?? '')
    return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
  }
  return `\ufeff${rows.map(row => row.map(cell).join(',')).join('\n')}`
}
