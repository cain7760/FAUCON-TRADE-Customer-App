import { accountLabel, activityText, canceledOrderValue, fillProgress, formatNumber, frozenMarginValue, marketLabel, orderQuantity, price } from './model.js'
import { withoutShareUnit } from '../../../utils/tableQuantity.js'
import { averageFillPrice, filledAmount } from './orderCalculations.js'

// Customer OrdersTable / orderColumnOptions：业务字段逐列展示，不合并价格、进度或来源。
const shares = value => value ? formatNumber(value, 3, false) : '--'
export const orderTableColumns = [
  { key: 'index', title: '序号', width: 36, value: (row, index) => index + 1 },
  { key: 'code', title: '证券代码', width: 72, value: row => row.code },
  { key: 'name', title: '证券名称', width: 76, text: true, value: row => row.name },
  { key: 'status', title: '订单状态', width: 88, text: true, readable: true, value: row => row.status },
  { key: 'fillProgress', title: '成交进度', width: 84, value: fillProgress },
  { key: 'attribute', title: '订单属性', width: 60, text: true, readable: true, value: row => row.type === 'market' ? '市价单' : '限价单' },
  { key: 'price', title: '订单限价', width: 68, value: row => row.price == null ? '--' : price(row.price, row.market) },
  { key: 'orderValueNumber', title: '订单数量/金额', width: 88, value: orderQuantity },
  { key: 'filledQuantity', title: '已成数量', width: 84, value: row => shares(row.filledQuantity) },
  { key: 'filledPrice', title: '成交均价', width: 68, value: row => price(averageFillPrice(row), row.market) },
  { key: 'side', title: '方向', width: 40, text: true, readable: true, value: row => row.side === 'buy' ? '买' : '卖', tone: row => row.side === 'buy' ? 'equity-positive' : 'equity-negative' },
  { key: 'filledAmount', title: '成交金额', width: 100, value: row => formatNumber(filledAmount(row)) },
  { key: 'canceledValue', title: '撤单数量/金额', width: 80, value: row => withoutShareUnit(canceledOrderValue(row)) },
  { key: 'frozenMargin', title: '冻结保证金', width: 100, value: frozenMarginValue },
  { key: 'marginRate', title: '保证金率', width: 60, value: row => row.marginRate == null ? '--' : `${formatNumber(row.marginRate, 2, false)}%` },
  { key: 'orderNo', title: '订单编号', width: 112, value: row => row.orderNo || '--' },
  { key: 'orderTime', title: '订单时间', width: 68, value: row => row.orderTime ? String(row.orderTime).slice(-8) : '--' },
  { key: 'account', title: '下单账户', width: 96, text: true, value: row => accountLabel(row.account) },
  { key: 'market', title: '市场', width: 40, text: true, value: row => marketLabel(row) },
  { key: 'currency', title: '币种', width: 40, text: true, value: row => row.currency || (row.market === 'HK' ? 'HKD' : row.market === 'US' ? 'USD' : 'CNY') },
  { key: 'orderType', title: '订单类型', width: 60, text: true, value: row => row.orderType || '--' },
  { key: 'algorithm', title: '执行算法', width: 60, text: true, value: row => row.algorithm || '--' },
  { key: 'orderRemark', title: '下单备注', width: 104, text: true, truncate: true, value: row => row.orderRemark || '--' },
  { key: 'feedback', title: '订单动态', width: 144, text: true, truncate: true, value: activityText },
  { key: 'openClose', title: '开平方向', width: 60, text: true, value: row => row.openClose === '开' ? '开仓' : '平仓' },
  { key: 'reportQuantity', title: '挂单数量', width: 84, value: row => shares(row.reportQuantity) },
]
