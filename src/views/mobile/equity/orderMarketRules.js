// 产品下单规则；不代表交易所对所有订单类型的定义。
export function canUseMarketOrder(symbol) {
  const market = symbol?.market || String(symbol?.code || '').split('.')[1]
  return String(market || '').toUpperCase() !== 'HK'
}

export function normalizeOrderType(type, symbol) {
  return type === 'market' && canUseMarketOrder(symbol) ? 'market' : 'limit'
}

export function orderTypeError(type, symbol) {
  return type === 'market' && !canUseMarketOrder(symbol) ? '港股仅支持限价单，请填写订单限价。' : ''
}
