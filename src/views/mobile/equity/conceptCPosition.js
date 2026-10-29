import { detailSections, formatNumber, pnlClass, price } from './model.js'
import { positionMarginInCny } from './positionCurrency.js'

// 展示分组，不改变业务数值、精度或账户口径。
export function conceptCPositionMetrics(record, drawer = false) {
  const currency = record.currency || 'CNY'
  const fields = [
    { key: 'cost', label: '持仓均价', value: price(record.cost, record.market) },
    { key: 'latest', label: '最新价', value: price(record.price, record.market), tone: pnlClass(record.change) },
    { key: 'qty', label: '持仓数量（股）', value: formatNumber(record.qty, 3, false) },
    { key: 'value', label: `市值（${currency}）`, value: formatNumber(record.value) },
  ]
  if (drawer) fields.push(
    { key: 'marginOccupied', label: '保证金占用（CNY）', value: formatNumber(positionMarginInCny(record)) },
    { key: 'marginRate', label: '保证金率', value: record.marginRate == null || !Number.isFinite(Number(record.marginRate)) ? '--' : `${formatNumber(record.marginRate)}%` },
  )
  return fields
}

export function conceptCPositionAdditionalSections(record, index) {
  // 这些字段已在摘要、六项指标或固定操作栏展示，其余字段全部保留。
  const displayed = new Set(['name', 'code', 'price', 'qty', 'available', 'value', 'marginOccupied', 'marginRate', 'floatingProfit'])
  return detailSections('positions', record, index)
    .map(section => ({ ...section, fields: section.fields.filter(field => !displayed.has(field.key)) }))
    .filter(section => section.fields.length)
}

export const canCloseConceptCPosition = record => record.direction === '多' && Number(record.available) > 0
export const conceptCPositionColumnWidths = Object.freeze({ symbol: 114, price: 88, floatingProfit: 94, holdingQty: 95 })
