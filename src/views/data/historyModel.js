// 历史业务日期独立于电脑时区。接入接口后继续使用服务端返回的业务日期。
export const historyTimeZone = 'Asia/Shanghai'
export const historyOrderStatuses = ['未报', '待报', '已报', '待改', '待撤', '部撤', '撤单', '部成', '全成', '拒单', '异常']
export const historyAccounts = [{ id: 'TZS_T0', name: '自营一号' }, { id: 'TZS_T1', name: '自营二号' }]
export const historyTabs = [{ key: 'orders', label: '历史委托' }, { key: 'trades', label: '历史成交' }]

export function historyToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: historyTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function shiftHistoryDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function isHistoryDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
export function defaultHistoryFilters(today = historyToday()) {
  return { range: [shiftHistoryDate(today, -29), today], symbol: '', orderNo: '', tradeNo: '', account: 'ALL', accounts: [], side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] }
}
export function validateHistoryRange(range, today = historyToday()) {
  if (!Array.isArray(range) || range.length !== 2 || !range.every(isHistoryDate)) return '请选择完整、有效的起止日期'
  if (range[0] > range[1]) return '开始日期不能晚于结束日期'
  if (range[1] > today) return '查询日期不能晚于今天'
  return ''
}
export const cloneHistoryFilters = filters => ({ ...filters, range: [...(filters.range || [])], accounts: [...(filters.accounts || [])], status: [...filters.status] })

export function filterHistoryRecords(kind, records, filters, today = historyToday()) {
  if (validateHistoryRange(filters.range, today)) return []
  const contains = (value, query) => String(value ?? '').toLowerCase().includes(String(query || '').trim().toLowerCase())
  return records.filter(row => {
    const date = kind === 'orders' ? row.orderDate : row.tradeDate
    return isHistoryDate(date) && date <= today && date >= filters.range[0] && date <= filters.range[1]
      && (kind !== 'trades' || (Number.isFinite(Number(row.filledQuantity)) && Number(row.filledQuantity) > 0 && Boolean(row.tradeNo)))
      && contains(`${row.code}.${row.market} ${row.name}`, filters.symbol)
      && contains(row.orderNo, filters.orderNo) && (kind !== 'trades' || contains(row.tradeNo, filters.tradeNo))
      && ['account', 'side', 'openClose'].every(key => filters[key] === 'ALL' || row[key] === filters[key])
      && (!filters.accounts?.length || filters.accounts.includes(row.account))
      && (kind !== 'orders' || !filters.status.length || filters.status.includes(row.status))
  })
}

// 十进制字符串截断，避免 1.13 * 100 之类的二进制误差导致少一分；不四舍五入。
export function historyNumber(value, digits = 2, fixed = true) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '--'
  const match = String(value).trim().match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match || !(match[2] || match[3])) return '--'
  const scale = (match[3] || '').length - Number(match[4] || 0)
  let integer = BigInt(`${match[1]}${match[2] || '0'}${match[3] || ''}`)
  integer = scale > digits ? integer / 10n ** BigInt(scale - digits) : integer * 10n ** BigInt(digits - scale)
  const negative = integer < 0n
  const text = String(negative ? -integer : integer).padStart(digits + 1, '0')
  const whole = digits ? text.slice(0, -digits) : text
  let fraction = digits ? text.slice(-digits) : ''
  if (!fixed) fraction = fraction.replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`
}
const quantity = value => value == null ? '--' : `${historyNumber(value, 3, false)} 股`
const amountUnit = row => ({ CNY: '元', HKD: '港元', USD: '美元' }[row.currency] || row.currency)
export function historyCell(row, key) {
  const zeroIsEmpty = ['filledQuantity', 'filledPrice', 'filledAmount', 'reportQuantity', 'canceledValue'].includes(key)
  if (zeroIsEmpty && !Number(row[key])) return '--'
  if (['price', 'filledPrice'].includes(key)) return row[key] == null ? '--' : historyNumber(row[key], row.market === 'HK' ? 3 : 2)
  if (['filledAmount', 'frozenMargin'].includes(key)) return row[key] == null ? '--' : historyNumber(row[key])
  if (['filledQuantity', 'reportQuantity'].includes(key)) return historyNumber(row[key], 3, false)
  if (key === 'orderValue') return row.inputAmount != null ? `${historyNumber(row.inputAmount)} ${amountUnit(row)}` : quantity(row.quantity)
  if (key === 'canceledValue') return row.inputAmount != null ? `${historyNumber(row.canceledValue)} ${amountUnit(row)}` : historyNumber(row.canceledValue, 3, false)
  if (key === 'fillProgress') return row.quantity > 0 ? `${historyNumber(Math.min(100, (row.filledQuantity || 0) / row.quantity * 100), 2, false)}%` : '--'
  if (key === 'side') return row.side === 'buy' ? '买' : '卖'
  if (key === 'openClose') return row.openClose === '开' ? '开仓' : '平仓'
  if (key === 'attribute') return row.type === 'market' ? '市价单' : '限价单'
  if (key === 'marginRate') return row.marginRate == null ? '--' : `${historyNumber(row.marginRate, 2, false)}%`
  if (key === 'market') return ({ SZ: '深市', SH: '沪市', HK: '港股', US: '美股' }[row.market] || row.market)
  if (key === 'code') return `${row.code}.${row.market}`
  if (key === 'algorithm') return row.algorithm === 'none' ? '无需算法' : row.algorithm || '--'
  return row[key] ?? '--'
}
const column = (key, label, width = 100, numeric = false) => ({ key, label, width, numeric })
const commonColumns = [column('accountLabel', '下单账户', 188), column('market', '市场', 64), column('currency', '币种', 64), column('orderType', '订单类型', 88), column('algorithm', '执行算法', 88), column('orderRemark', '下单备注', 160), column('feedback', '订单动态', 200)]
export const historyColumns = {
  orders: [column('orderDate', '委托日期', 104), column('code', '证券代码', 104), column('name', '证券名称', 96), column('status', '订单状态', 96), column('side', '方向', 64), column('openClose', '开平方向', 88), column('attribute', '订单属性', 88), column('price', '订单限价', 100, true), column('orderValue', '订单数量/金额', 144, true), column('fillProgress', '成交进度', 100, true), column('filledQuantity', '已成数量', 112, true), column('filledPrice', '成交均价', 100, true), column('filledAmount', '成交金额', 128, true), column('canceledValue', '撤单数量/金额', 144, true), column('frozenMargin', '冻结保证金', 120, true), column('marginRate', '保证金率', 96, true), column('orderNo', '订单编号', 190), column('orderTime', '订单时间', 100), ...commonColumns, column('reportQuantity', '挂单数量', 112, true)],
  trades: [column('tradeDate', '交易日期', 104), column('code', '证券代码', 104), column('name', '证券名称', 96), column('side', '方向', 64), column('openClose', '开平方向', 88), column('filledPrice', '成交价格', 100, true), column('filledQuantity', '成交数量', 112, true), column('filledAmount', '成交金额', 128, true), column('filledTime', '成交时间', 100), column('orderDate', '委托日期', 104), column('orderTime', '订单时间', 100), column('tradeNo', '成交编号', 208), column('orderNo', '订单编号', 190), ...commonColumns],
}
export function sortHistoryRecords(kind, rows, sort = {}) {
  const timeKey = row => kind === 'orders' ? `${row.orderDate} ${row.orderTime}` : `${row.tradeDate} ${row.filledTime}`
  const compareDefault = (a, b) => timeKey(b).localeCompare(timeKey(a)) || String(a.id).localeCompare(String(b.id))
  const key = ({ quantity: 'orderValue', orderValueNumber: 'orderValue', entrustNo: 'orderNo', account: 'accountLabel' })[sort.key] || sort.key
  const value = row => key === 'attribute' ? (row.type === 'market' ? '市价单' : '限价单') : key === 'orderValue' ? row.inputAmount ?? row.quantity : key === 'fillProgress' ? (row.quantity > 0 ? row.filledQuantity / row.quantity : -1) : row[key]
  const numeric = historyColumns[kind].find(column => column.key === key)?.numeric
  return [...rows].sort((a, b) => {
    if (!sort.key || !sort.direction) return compareDefault(a, b)
    const left = value(a), right = value(b)
    const result = numeric ? Number(left ?? -Infinity) - Number(right ?? -Infinity) : String(left ?? '').localeCompare(String(right ?? ''), 'zh-CN')
    return (sort.direction === 'ascending' ? result : -result) || compareDefault(a, b)
  })
}
function csvCell(value) {
  let text = String(value ?? '')
  if (/^[\s]*[=+\-@]/.test(text) && !/^-?\d[\d,]*(?:\.\d+)?$/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function historyCsv(kind, rows, range) {
  const columns = historyColumns[kind]
  const lines = [columns.map(column => column.label), ...rows.map(row => columns.map(column => historyCell(row, column.key)))]
  return { filename: `${kind === 'orders' ? '历史委托' : '历史成交'}_${range[0]}_${range[1]}.csv`, content: `\ufeff${lines.map(line => line.map(csvCell).join(',')).join('\r\n')}`, count: rows.length }
}
