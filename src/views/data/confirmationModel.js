import { historyToday, shiftHistoryDate, validateHistoryRange } from './historyModel.js'

// 只读参考：生产页「收益互换－交易事件」当前可见的 3 组、10 条记录。
// 本地静态快照；不连接生产接口。下载文件由显式文件清单提供。
export const confirmationColumns = [
  ['documentNo', '确认书文档编号', 196], ['masterContractNo', '主合约编号', 128],
  ['confirmationNo', '交易确认书编号', 184], ['contractNo', '合约编号', 176],
  ['eventNo', '事件编号', 88], ['eventType', '事件类型', 72], ['eventDate', '事件日期', 92],
  ['book', '交易簿', 76], ['counterpartyNo', '交易对手号', 104], ['counterparty', '交易对手', 104],
  ['department', '交易对手部门', 104], ['sales', '销售', 64], ['swapType', '互换类型', 80],
  ['businessType', '业务类型', 80], ['subBusinessType', '子业务类型', 88], ['crossBorder', '跨境类型', 80],
  ['tradeCurrency', '交易货币', 76], ['settlementCurrency', '结算货币', 76], ['approvalStatus', '审批状态', 80],
  ['operatedAt', '操作时间', 144], ['operator', '操作用户', 80], ['template', '交易确认书模板', 196],
].map(([key, label, width]) => ({ key, label, width }))

export const confirmationGroups = [
  { documentNo: 'cw0349_test-20261026', masterContractNo: 'cw0349_test_CNY', counterpartyNo: 'cw0349_test', counterparty: 'cw0349_test', eventDate: '2026-10-26', sequenceDate: '261026', confirmationSequences: [66927, 66926, 66925], contractSequences: [3, 2, 1], operatedTimes: ['10:50:30', '10:50:30', '10:50:29'] },
  { documentNo: 'cw0341_test-20261013', masterContractNo: 'cw0341_test_CNY', counterpartyNo: '2404001', counterparty: 'cw0341_test', eventDate: '2026-10-13', sequenceDate: '261013', confirmationSequences: [66924, 66923, 66922], contractSequences: [3, 2, 1], operatedTimes: ['10:36:06', '10:36:05', '10:36:04'] },
  { documentNo: 'cw0339_test-20261012', masterContractNo: 'cw0339_test_CNY', counterpartyNo: '2403001', counterparty: 'cw0339_test', eventDate: '2026-10-12', sequenceDate: '261012', confirmationSequences: [66921, 66920, 66919, 66918], contractSequences: [4, 3, 2, 1], operatedTimes: ['11:23:00', '11:22:59', '11:22:58', '11:22:57'] },
]
export function createConfirmationRecords() {
  return confirmationGroups.flatMap(group => group.confirmationSequences.map((sequence, index) => ({
    id: `confirmation-${sequence}`, documentNo: group.documentNo, masterContractNo: group.masterContractNo,
    confirmationNo: `SWAP-${group.counterpartyNo}-${group.sequenceDate}${sequence}`,
    contractNo: `SWP-${group.counterpartyNo}-${group.sequenceDate}${String(group.contractSequences[index]).padStart(4, '0')}`,
    eventNo: '', eventType: '开仓', eventDate: group.eventDate, book: '跨境TRS',
    counterpartyNo: group.counterpartyNo, counterparty: group.counterparty, department: '', sales: '',
    swapType: '多头互换', businessType: '收益互换', subBusinessType: '权益&商品', crossBorder: '非跨境',
    tradeCurrency: 'CNY', settlementCurrency: 'CNY', approvalStatus: '无需审批',
    operatedAt: `${group.eventDate} ${group.operatedTimes[index]}`, operator: 'Emily_AI',
    template: '汇总交易确认书模板_20250718-致富.xlsx',
  })))
}
export function sortConfirmations(rows, sort = {}) {
  return [...rows].sort((a, b) => {
    const order = sort.key && sort.direction && sort.direction !== 'none' ? String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''), 'zh-CN') * (sort.direction === 'ascending' ? 1 : -1) : 0
    return order || b.eventDate.localeCompare(a.eventDate)
  })
}
export function groupConfirmations(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.documentNo)) groups.set(row.documentNo, { id: `document-${row.documentNo}`, documentNo: row.documentNo, template: row.template, isDocument: true, children: [] })
    groups.get(row.documentNo).children.push(row)
  }
  return [...groups.values()]
}

// 与参考页查询项一致，邮件功能及其筛选不属于本系统。
export const confirmationFilterFields = [
  { key: 'range', label: '事件日期', type: 'date', width: 192, primary: true },
  { key: 'documentNo', label: '确认书文档编号', width: 156, primary: true },
  { key: 'counterparty', label: '交易对手', width: 156, primary: true },
  { key: 'masterContractNo', label: '主合约编号', width: 156, primary: true },
  { key: 'book', label: '交易簿', width: 156 },
  { key: 'confirmationNo', label: '交易确认书编号', width: 156 },
  { key: 'contractNo', label: '合约编号', width: 156 },
  { key: 'eventNo', label: '事件编号', width: 156 },
  { key: 'eventType', label: '事件类型', width: 156, options: ['开仓', '部分平仓', '平仓', '修改交易要素'] },
  { key: 'swapType', label: '互换类型', width: 156 },
  { key: 'businessType', label: '业务类型', width: 156 },
  { key: 'subBusinessType', label: '子业务类型', width: 156 },
  { key: 'approvalStatus', label: '审批状态', width: 156 },
  { key: 'operator', label: '操作用户', width: 156 },
  { key: 'tradeCurrency', label: '交易货币', width: 156, options: ['CNY', 'HKD', 'USD'] },
]
export function defaultConfirmationFilters(today = historyToday()) {
  return { ...Object.fromEntries(confirmationFilterFields.map(field => [field.key, field.type === 'date' ? [shiftHistoryDate(today, -6), today] : ''])), status: [] }
}
export const cloneConfirmationFilters = value => ({ ...value, range: [...(value.range || [])], status: [...value.status] })
export function validateConfirmationRange(range, today = historyToday()) {
  if (range == null || (Array.isArray(range) && range.every(value => value == null || value === ''))) return ''
  return validateHistoryRange(range, today)
}
export function filterConfirmations(records, filters, today = historyToday()) {
  if (validateConfirmationRange(filters.range, today)) return []
  const hasRange = filters.range?.some(Boolean)
  const contains = (value, query) => String(value || '').toLowerCase().includes(String(query || '').trim().toLowerCase())
  return records.filter(row => row.eventDate <= today && (!hasRange || (row.eventDate >= filters.range[0] && row.eventDate <= filters.range[1]))
    && contains(row.documentNo, filters.documentNo)
    && confirmationFilterFields.every(field => field.type === 'date' || (field.options ? !filters[field.key] || row[field.key] === filters[field.key] : contains(row[field.key], filters[field.key]))))
}
export const confirmationFiles = {
  'cw0349_test-20261026': { path: 'confirmations/cw0349_test_20261026_Trade_Confirmation.pdf', name: 'cw0349_test_20261026_Trade Confirmation.pdf' },
  'cw0341_test-20261013': { path: 'confirmations/cw0341_test_20261013_Trade_Confirmation_demo.pdf', name: 'cw0341_test_20261013_Trade Confirmation_演示.pdf', demo: true },
  'cw0339_test-20261012': { path: 'confirmations/cw0339_test_20261012_Trade_Confirmation_demo.pdf', name: 'cw0339_test_20261012_Trade Confirmation_演示.pdf', demo: true },
}
