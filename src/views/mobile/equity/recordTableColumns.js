import { accountLabel, activityText, formatNumber, pnlClass, price } from './model.js'
import { orderTableColumns } from './orderTableColumns.js'
import { positionMarginInCny } from './positionCurrency.js'

const timeLabel = value => value ? String(value).slice(-8) : '--'
export function recordTableColumns(kind) {
  // Customer PositionsTable + columnOptions：总盈亏、实现盈亏不属于当前可选表格列。
  if (kind === 'positions') return [
    { key: 'price', title: '持仓均价', secondTitle: '最新价', width: 64, value: row => price(row.cost, row.market), second: row => price(row.price, row.market), secondTone: row => pnlClass(row.change) },
    { key: 'floatingProfit', title: '浮动盈亏', width: 76, value: row => formatNumber(row.floatingProfit), tone: row => row.floatingProfit >= 0 ? 'equity-positive' : 'equity-negative' },
    { key: 'holdingQty', title: '持仓数量', width: 68, value: row => formatNumber(row.qty, 3, false) },
    { key: 'valueWan', title: '市值', secondTitle: '可用数量', width: 104, value: row => formatNumber(row.value), second: row => formatNumber(row.available, 3, false), secondTone: () => 'equity-accent' },
    { key: 'marginOccupied', title: '保证金占用', secondTitle: '（CNY）', width: 96, value: row => formatNumber(positionMarginInCny(row)) },
    { key: 'marginRate', title: '保证金率', width: 60, value: row => row.marginRate == null || !Number.isFinite(Number(row.marginRate)) ? '--' : `${formatNumber(row.marginRate)}%` },
    { key: 'account', title: '下单账户', width: 96, gapBefore: 8, text: true, value: row => accountLabel(row.account) },
    { key: 'market', title: '市场', width: 40, gapBefore: 8, text: true, value: row => ({ SZ: '深市', SH: '沪市', HK: '港股', US: '美股', A: 'A股' }[row.market] || row.market || '--') },
    { key: 'currency', title: '币种', width: 40, text: true, value: row => row.currency },
    { key: 'direction', title: '多空方向', width: 60, text: true, value: row => row.direction === '多' ? '做多' : '做空', tone: row => ['record-tag', row.direction === '多' ? 'record-tag-long' : 'record-tag-short'] },
    { key: 'orderRemark', title: '下单备注', width: 104, text: true, wrap: true, value: row => row.orderRemark || '--' },
    { key: 'traderRemark', title: '交易员备注', width: 104, text: true, wrap: true, value: row => row.traderRemark || '--' },
  ]
  const account = { key: 'account', title: '下单账户', width: 96, text: true, value: row => accountLabel(row.account) }
  if (kind === 'orders') return orderTableColumns
  // Customer TradesTable / tradeColumnOptions 的完整业务字段，标的名称与代码仍合并固定。
  return [
    { key: 'index', title: '序号', width: 32, value: (row, index) => index + 1 },
    { key: 'side', title: '方向', width: 40, text: true, value: row => row.side === 'buy' ? '买' : '卖', tone: row => row.side === 'buy' ? 'equity-positive' : 'equity-negative' },
    { key: 'filledPrice', title: '成交均价', width: 64, value: row => price(row.filledPrice, row.market) },
    { key: 'filledQuantity', title: '成交数量', width: 84, value: row => formatNumber(row.filledQuantity ?? 0, 3, false) },
    { key: 'filledAmount', title: '成交金额', width: 96, value: row => formatNumber(row.filledAmount) },
    { key: 'filledTime', title: '成交时间', width: 68, value: row => timeLabel(row.filledTime) },
    { key: 'orderTime', title: '订单时间', width: 68, value: row => timeLabel(row.orderTime) },
    { key: 'tradeNo', title: '成交编号', width: 96, value: row => row.tradeNo || '--' },
    { key: 'entrustNo', title: '订单编号', width: 112, value: row => row.entrustNo || '--' },
    { key: 'tradeDate', title: '交易日期', width: 72, value: row => row.tradeDate || '--' },
    account,
    { key: 'market', title: '市场', width: 40, text: true, value: row => row.market === 'HK' ? '港股' : 'A股' },
    { key: 'currency', title: '币种', width: 40, text: true, value: row => row.currency || (row.market === 'HK' ? 'HKD' : row.market === 'US' ? 'USD' : 'CNY') },
    { key: 'orderType', title: '订单类型', width: 60, text: true, value: row => row.orderType || '--' },
    { key: 'algorithm', title: '执行算法', width: 60, text: true, value: row => row.algorithm || '--' },
    { key: 'orderRemark', title: '下单备注', width: 104, text: true, truncate: true, value: row => row.orderRemark || '--' },
    { key: 'feedback', title: '订单动态', width: 144, text: true, truncate: true, value: activityText },
    { key: 'openClose', title: '开平方向', width: 60, text: true, value: row => row.openClose === '开' ? '开仓' : '平仓' },
  ]
}
