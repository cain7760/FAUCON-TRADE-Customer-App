import { accounts, orderStatuses } from './fixtures.js'

export const listTabs = [
  { key: 'positions', label: '所有持仓', detail: '持仓详情', empty: '无匹配持仓，请调整或重置筛选' },
  { key: 'orders', label: '所有订单', detail: '订单详情', empty: '暂无订单记录' },
  { key: 'trades', label: '所有成交', detail: '成交详情', empty: '暂无成交记录' },
]

export const defaultFilters = () => ({ symbol: '', orderNo: '', market: 'ALL', direction: 'ALL', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] })
const options = pairs => pairs.map(([value, label]) => ({ value, label }))
const sharedFilters = [
  { key: 'side', label: '买卖方向', options: options([['ALL', '全部'], ['buy', '买'], ['sell', '卖']]) },
  { key: 'openClose', label: '开平类型', options: options([['ALL', '全部'], ['开', '开仓'], ['平', '平仓']]) },
  { key: 'orderType', label: '订单类型', options: options([['ALL', '全部'], ['系统单', '系统单'], ['手工单', '手工单']]) },
]
export const filterGroups = {
  positions: [
    { key: 'market', label: '市场', options: options([['ALL', '全部市场'], ['SZ', '深市'], ['SH', '沪市']]) },
    { key: 'direction', label: '多空方向', options: options([['ALL', '全部'], ['多', '做多'], ['空', '做空']]) },
  ],
  orders: sharedFilters,
  trades: sharedFilters,
}
export { orderStatuses }

export function filterCount(kind, filters) {
  return Number(Boolean(filters.symbol.trim())) + Number(kind === 'orders' && Boolean(filters.orderNo.trim()))
    + filterGroups[kind].filter(group => filters[group.key] !== 'ALL').length
    + Number(kind === 'orders' && filters.status.length > 0)
}

export const advancedFilterCount = (kind, filters) => filterCount(kind, filters) - Number(Boolean(filters.symbol.trim()))

export function activeFilterLabels(kind, filters) {
  const labels = []
  if (filters.symbol.trim()) labels.push(`标的：${filters.symbol.trim()}`)
  if (kind === 'orders' && filters.orderNo.trim()) labels.push(`订单编号：${filters.orderNo.trim()}`)
  for (const group of filterGroups[kind]) {
    const selected = group.options.find(option => option.value === filters[group.key])
    if (selected && selected.value !== 'ALL') labels.push(`${group.label}：${selected.label}`)
  }
  if (kind === 'orders' && filters.status.length) labels.push(`订单状态：${filters.status.join('、')}`)
  return labels
}

export function filterRecords(kind, records, filters, accountIds) {
  const contains = (value, query) => String(value).toLowerCase().includes(query.trim().toLowerCase())
  const result = records.filter(row => accountIds.includes(row.account)
    && contains(`${row.code}.${row.market}${row.name}`, filters.symbol)
    && (kind !== 'orders' || (contains(row.orderNo, filters.orderNo) && (!filters.status.length || filters.status.includes(row.status))))
    && filterGroups[kind].every(group => filters[group.key] === 'ALL' || row[group.key] === filters[group.key]))
  if (kind === 'orders') {
    const rank = row => row.status === '被拒绝' ? (row.orderType === '系统单' ? 0 : 1) : 2
    result.sort((a, b) => rank(a) - rank(b))
  }
  return result
}

// 沿用 Customer 的截断展示口径，不四舍五入；空值不能被 Number(null) 变成 0。
export function formatNumber(value, digits = 2, fixed = true) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '--'
  const factor = 10 ** digits
  const number = Math.trunc(Number(value) * factor) / factor
  return (Object.is(number, -0) ? 0 : number).toLocaleString('en-US', { minimumFractionDigits: fixed ? digits : 0, maximumFractionDigits: digits })
}
export const price = (value, market) => formatNumber(value, market === 'HK' ? 3 : 2)
export const shares = value => value == null ? '--' : `${formatNumber(value, 3, false)} 股`
export const pnlClass = value => value > 0 ? 'equity-positive' : value < 0 ? 'equity-negative' : ''
export const signedMoney = value => `${value > 0 ? '+' : ''}${formatNumber(value)}`
export const accountLabel = id => { const account = accounts.find(item => item.id === id); return account ? `${account.id} - ${account.name}` : '--' }
export const sideLabel = row => `${row.side === 'buy' ? '买' : '卖'} · ${row.openClose === '开' ? '开仓' : '平仓'}`
export const orderPrice = row => row.type === 'market' ? '市价' : price(row.price, row.market)
export const orderQuantity = row => row.inputAmount != null ? `${formatNumber(row.orderValueNumber ?? row.inputAmount)} 元` : shares(row.quantity)
export const fillProgress = row => row.quantity > 0 ? `${Math.round(Math.min(1, Math.max(0, row.filledQuantity / row.quantity)) * 100)}%` : '--'
export const activityText = row => [row.feedback && `系统：${row.feedback}`, row.traderRemark && `交易员：${row.traderRemark}`].filter(Boolean).join('；') || '--'

const numericFields = new Set(['index', 'code', 'price', 'opening', 'qty', 'available', 'value', 'marginOccupied', 'marginRate', 'totalProfit', 'dailyRealizedProfit', 'floatingProfit', 'orderNo', 'quantity', 'orderTime', 'reportQuantity', 'fillProgress', 'filledQuantity', 'filledPrice', 'filledAmount', 'canceledValue', 'frozenMargin', 'filledTime', 'tradeDate', 'tradeNo', 'entrustNo'])
const field = (key, label, value, extra = {}) => ({ key, label, value: value ?? '--', numeric: numericFields.has(key), ...extra })
export function detailSections(kind, row, index) {
  const basic = [field('index', '序号', index), field('code', '证券代码', `${row.code}.${row.market}`), field('name', '证券名称', row.name)]
  const account = [field('account', '下单账户', accountLabel(row.account)), field('market', '市场', kind === 'positions' ? (row.market === 'SZ' ? '深市' : '沪市') : (row.market === 'HK' ? '港股' : row.market === 'US' ? '美股' : 'A股')), field('currency', '币种', row.currency)]
  const money = (key, label, extra) => field(key, label, formatNumber(row[key]), extra)
  const quantity = (key, label) => field(key, label, shares(row[key]))
  const remarks = [{ title: '备注', fields: [field('orderRemark', '下单备注', row.orderRemark || '--', { multiline: true }), ...(kind === 'positions' ? [field('traderRemark', '交易员备注', row.traderRemark || '--', { multiline: true })] : [field('feedback', '订单动态', activityText(row), { multiline: true })])] }]
  if (kind === 'positions') return [
    { title: '持仓信息', fields: [...basic, field('direction', '多空方向', row.direction === '多' ? '做多' : '做空'), ...account] },
    { title: '价格与数量', fields: [field('price', '持仓均价 / 最新价', `${price(row.cost, row.market)} / ${price(row.price, row.market)}`), quantity('opening', '期初数量'), quantity('qty', '持仓数量'), quantity('available', '可用数量')] },
    { title: '市值与盈亏', fields: [money('value', '市值'), money('marginOccupied', '占用保证金'), field('marginRate', '保证金率', `${formatNumber(row.marginRate)}%`), ...[['totalProfit', '总盈亏'], ['dailyRealizedProfit', '实现盈亏'], ['floatingProfit', '浮动盈亏']].map(([key, label]) => money(key, label, { tone: pnlClass(row[key]) }))] },
    ...remarks,
  ]
  const execution = [...account, field('orderType', '订单类型', row.orderType), field('algorithm', '执行算法', row.algorithm)]
  const direction = [field('side', '方向', row.side === 'buy' ? '买' : '卖'), field('openClose', '开平方向', row.openClose === '开' ? '开仓' : '平仓')]
  if (kind === 'orders') return [
    { title: '订单信息', fields: [...basic, field('orderNo', '订单编号', row.orderNo, { copyable: true }), field('status', '订单状态', row.status), ...direction, field('attribute', '订单属性', row.attribute || (row.type === 'market' ? '市价单' : '限价单')), field('price', '订单价格', orderPrice(row)), field('quantity', '订单数量/金额', orderQuantity(row)), field('orderTime', '订单时间', row.orderTime)] },
    { title: '成交与撤单', fields: [field('reportQuantity', '挂单数量', row.reportQuantity ? shares(row.reportQuantity) : '--'), field('fillProgress', '成交进度', fillProgress(row)), field('filledQuantity', '已成数量', row.filledQuantity ? shares(row.filledQuantity) : '--'), field('filledPrice', '成交均价', price(row.filledPrice, row.market)), field('filledAmount', '成交金额', row.filledQuantity ? formatNumber(row.filledQuantity * row.filledPrice) : '--'), field('canceledValue', '撤单数量/金额', row.canceledAmount ? formatNumber(row.canceledAmount) : row.canceledQuantity ? shares(row.canceledQuantity) : '--')] },
    { title: '账户与执行', fields: [...execution, money('frozenMargin', '冻结保证金'), field('marginRate', '保证金率', `${row.marginRate}%`)] },
    ...remarks,
  ]
  return [
    { title: '成交信息', fields: [...basic, ...direction, field('filledPrice', '成交均价', price(row.filledPrice, row.market)), quantity('filledQuantity', '成交数量'), money('filledAmount', '成交金额'), field('filledTime', '成交时间', row.filledTime), field('tradeDate', '交易日期', row.tradeDate)] },
    { title: '关联订单', fields: [field('tradeNo', '成交编号', row.tradeNo, { copyable: true }), field('entrustNo', '订单编号', row.entrustNo, { copyable: true }), field('orderTime', '订单时间', row.orderTime)] },
    { title: '账户与执行', fields: execution }, ...remarks,
  ]
}
