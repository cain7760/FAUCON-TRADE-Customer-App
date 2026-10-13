export const marketInstruments = [
  { code: '000001', name: '平安银行', market: 'SZ', price: 11.78, change: 0.68, high: 11.86, low: 11.63, volume: '1.28亿' },
  { code: '600036', name: '招商银行', market: 'SH', price: 38.85, change: -0.46, high: 39.21, low: 38.66, volume: '7,862万' },
  { code: '600519', name: '贵州茅台', market: 'SH', price: 1456.00, change: 0.82, high: 1468.80, low: 1435.20, volume: '312万' },
  { code: '002594', name: '比亚迪', market: 'SZ', price: 245.80, change: 1.42, high: 248.16, low: 241.92, volume: '2,068万' },
  { code: '300750', name: '宁德时代', market: 'SZ', price: 186.32, change: 1.16, high: 188.20, low: 183.70, volume: '3,564万' },
]

export const positions = [
  { ...marketInstruments[0], cost: 11.70, quantity: 9300, available: 9300 },
  { ...marketInstruments[1], cost: 39.10, quantity: 8200, available: 6200 },
  { ...marketInstruments[2], cost: 1432.60, quantity: 500, available: 500 },
  { ...marketInstruments[3], cost: 242.50, quantity: 2000, available: 1200 },
]

export const initialOrders = [
  { id: 'WT20260911001', name: '平安银行', code: '000001.SZ', side: '买入', attribute: '开仓', orderType: '限价单', price: 11.78, quantity: 900, filledQuantity: 900, filledPrice: 11.78, status: '完成', submittedAt: '今天 10:12', note: '分批成交，已全部完成。' },
  { id: 'WT20260911002', name: '招商银行', code: '600036.SH', side: '卖出', attribute: '平仓', orderType: '限价单', price: 38.85, quantity: 2000, filledQuantity: 0, filledPrice: null, status: '已报', submittedAt: '今天 10:06', note: '请按委托价格优先处理。' },
  { id: 'WT20260911003', name: '贵州茅台', code: '600519.SH', side: '买入', attribute: '开仓', orderType: '市价单', price: null, quantity: 100, filledQuantity: 0, filledPrice: null, status: '待报', submittedAt: '昨天 14:36', note: '' },
  { id: 'WT20260910018', name: '比亚迪', code: '002594.SZ', side: '买入', attribute: '开仓', orderType: '限价单', price: 245.80, quantity: 500, filledQuantity: 300, filledPrice: 245.72, status: '部成', submittedAt: '昨天 13:24', note: '剩余委托继续有效。' },
  { id: 'WT20260909008', name: '宁德时代', code: '300750.SZ', side: '卖出', attribute: '平仓', orderType: '限价单', price: 186.32, quantity: 300, filledQuantity: 0, filledPrice: null, status: '已撤', submittedAt: '09-09 14:52', note: '客户主动撤单。' },
]

export const account = {
  name: 'Kevin Zhang',
  accountNo: 'CUS-002376',
  tradingAccount: 'TZS_T0 · 自营一号',
  totalAsset: 108920000,
  available: 27480000,
  marketValue: 81440000,
  profit: 1265800,
}

export const formatNumber = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value || 0))
export const formatMoney = value => formatNumber(value)
