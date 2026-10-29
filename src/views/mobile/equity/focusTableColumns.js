import { accountLabel, activityText, formatNumber, frozenMarginValue, price, signedMoney } from './model.js'
import { averageFillPrice, filledAmount, orderNotional } from './orderCalculations.js'
import { positionMarginInCny } from './positionCurrency.js'
import { recordTableColumns } from './recordTableColumns.js'
import { sortTableRecords } from './tableSorting.js'

const quantities = value => formatNumber(value, 3, false)
const currency = row => row.currency || ({ HK: 'HKD', US: 'USD' }[row.market] || 'CNY')
const market = row => ({ SZ: '深市', SH: '沪市', HK: '港股', US: '美股', A: 'A股', CN: 'A股' }[row.market] || row.market || '--')
const time = value => value ? String(value).slice(-8) : '--'
const identityColumns = [
  { key: 'code', title: '证券代码', width: 100, value: row => `${row.code}.${row.market}` },
  { key: 'name', title: '证券名称', width: 100, text: true, value: row => row.name },
]

// 对齐当前 PC columnOptions：持仓总盈亏/实现盈亏保留于详情，不是当前可配置表格列。
export function focusTableColumns(kind) {
  const columns = recordTableColumns(kind).filter(column => !['index', 'code', 'name'].includes(column.key))
  if (kind === 'positions') {
    const byKey = new Map(columns.map(column => [column.key, column]))
    byKey.set('opening', { key: 'opening', title: '期初数量', width: 88, value: row => quantities(row.opening ?? 0) })
    byKey.set('available', { key: 'available', title: '可用数量', width: 88, value: row => quantities(row.available) })
    byKey.set('valueWan', { key: 'valueWan', title: '市值', width: 104, value: row => formatNumber(row.value) })
    const order = ['price', 'opening', 'holdingQty', 'available', 'valueWan', 'marginOccupied', 'marginRate', 'floatingProfit', 'account', 'market', 'currency', 'direction', 'orderRemark', 'traderRemark']
    return [...identityColumns, ...order.map(key => byKey.get(key))]
  }
  if (kind === 'orders') return [...identityColumns, ...columns]
  const side = columns.find(column => column.key === 'side')
  return [side, ...identityColumns, ...columns.filter(column => column.key !== 'side')]
}

export function focusDefaultColumnKeys(kind) {
  return focusTableColumns(kind).filter(column => kind !== 'positions' || !['orderRemark', 'traderRemark'].includes(column.key)).map(column => column.key)
}

export function resolveFocusColumns(kind, keys) {
  const columns = focusTableColumns(kind)
  const byKey = new Map(columns.map(column => [column.key, column]))
  return [...new Set(keys ?? focusDefaultColumnKeys(kind))].map(key => byKey.get(key)).filter(Boolean)
}

export function sortFocusRecords(records, kind, column, direction) {
  // PC 双行价格列以最新价 price 排序；只在新版生效，基线仍走原 tableSorting。
  const sortColumn = kind === 'positions' && column?.key === 'price'
    ? { ...column, key: 'latestPrice', value: row => row.price }
    : column
  const sorted = sortTableRecords(records, kind, sortColumn, direction)
  // 异常订单无论升序、降序或默认顺序均置顶，同组保持原排序稳定性。
  return kind === 'orders' ? [...sorted.filter(row => row.status === '异常'), ...sorted.filter(row => row.status !== '异常')] : sorted
}

export function focusExportData(kind, rows) {
  if (kind === 'positions') return {
    filename: '持仓列表.csv',
    header: ['多空方向', '证券代码', '证券名称', '持仓均价', '最新价', '期初数量', '持仓数量', '可用数量', '市值', '保证金占用(CNY)', '保证金率', '浮动盈亏', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '交易员备注'],
    records: rows.map(row => [row.direction, `${row.code}.${row.market}`, row.name, price(row.cost, row.market), price(row.price, row.market), quantities(row.opening), quantities(row.qty), quantities(row.available), formatNumber(row.value), formatNumber(positionMarginInCny(row)), `${row.marginRate}%`, signedMoney(row.floatingProfit), accountLabel(row.account), market(row), currency(row), row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', row.traderRemark || '--']),
  }
  if (kind === 'orders') return {
    filename: '订单记录.csv',
    header: ['证券代码', '证券名称', '订单状态', '方向', '订单属性', '订单限价', '订单数量', '订单金额', '已成数量', '成交均价', '成交金额', '撤单数量', '撤单金额', '冻结保证金', '保证金率', '订单编号', '订单时间', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '订单动态', '开平方向', '挂单数量'],
    records: rows.map(row => [row.code, row.name, row.status, row.side === 'buy' ? '买' : '卖', row.type === 'market' ? '市价单' : '限价单', row.price == null ? '--' : price(row.price, row.market), quantities(row.quantity), row.inputAmount != null ? formatNumber(row.inputAmount) : row.price != null ? formatNumber(orderNotional(row.quantity, row.price)) : row.estimate ? formatNumber(row.estimate) : '--', row.filledQuantity ? quantities(row.filledQuantity) : '--', price(averageFillPrice(row), row.market), formatNumber(filledAmount(row)), row.canceledQuantity ? quantities(row.canceledQuantity) : '--', row.canceledAmount ? formatNumber(row.canceledAmount) : row.canceledQuantity && row.price != null ? formatNumber(orderNotional(row.canceledQuantity, row.price)) : '--', frozenMarginValue(row), row.marginRate == null ? '--' : `${formatNumber(row.marginRate, 2, false)}%`, row.orderNo, row.orderTime, accountLabel(row.account), market(row), currency(row), row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', activityText(row), row.openClose === '开' ? '开仓' : '平仓', row.reportQuantity ? quantities(row.reportQuantity) : '--']),
  }
  return {
    filename: '成交记录.csv',
    header: ['方向', '证券代码', '证券名称', '成交均价', '成交数量', '成交金额', '成交时间', '订单时间', '成交编号', '订单编号', '交易日期', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '订单动态', '开平方向'],
    records: rows.map(row => [row.side === 'buy' ? '买' : '卖', row.code, row.name, price(averageFillPrice(row), row.market), quantities(row.filledQuantity), formatNumber(row.filledAmount), time(row.filledTime), time(row.orderTime), row.tradeNo, row.entrustNo, row.tradeDate, accountLabel(row.account), market(row), currency(row), row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', activityText(row), row.openClose === '开' ? '开仓' : '平仓']),
  }
}

export function focusCsv(kind, rows) {
  const data = focusExportData(kind, rows)
  const cell = value => {
    const text = String(value ?? '--')
    // 备注、名称等外部文本按纯文本导出，阻止被表格软件当作公式；负数不加前缀。
    const safe = /^[=+@\t\r]/.test(text) || /^-(?!\d)/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  return { filename: data.filename, content: `\ufeff${[data.header, ...data.records].map(row => row.map(cell).join(',')).join('\r\n')}` }
}
