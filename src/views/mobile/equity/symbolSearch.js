// 当前演示标的的拼音首字母；生产搜索应由标的服务提供检索字段。
const initials = {
  '000001': 'PAYH', '002459': 'JAKJ', '300008': 'THFW', '000020': 'SHFA',
  '600036': 'ZSYH', '600519': 'GZMT', '000002': 'WKA', '600030': 'ZXZQ',
  '300750': 'NDSD', '601318': 'ZGPA', '600900': 'CJDL', '002594': 'BYD',
}
const normalize = value => String(value || '').replace(/\s/g, '').toUpperCase()

export function filterSymbolRecords(records, search = '') {
  const query = normalize(search)
  return records.filter(row => [row.name, `${row.code}.${row.market}`, initials[row.code]].some(value => normalize(value).includes(query)))
}

// 历史搜索词只有唯一匹配时才可还原为具体标的，避免把“600”等前缀误认成某一只股票。
export function resolveHistorySymbol(records, query) {
  if (!normalize(query)) return null
  const matches = filterSymbolRecords(records, query)
  return matches.length === 1 ? matches[0] : null
}

export function symbolHistoryLabel(records, query) {
  const row = resolveHistorySymbol(records, query)
  return row ? `${row.name}（${row.code}）` : ''
}

// 旧缓存可能含有模糊查询，只保留能确定为具体标的的记录。
export function normalizeSymbolHistory(records, history) {
  if (!Array.isArray(history)) return []
  return history.filter(term => typeof term === 'string').reduceRight((result, term) => {
    const row = resolveHistorySymbol(records, term)
    return row ? addSearchHistory(result, `${row.code}.${row.market}`) : result
  }, [])
}

export function addSearchHistory(history, query) {
  const term = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 80)
  return term ? [term, ...history.filter(item => normalize(item) !== normalize(term))].slice(0, 8) : history
}
