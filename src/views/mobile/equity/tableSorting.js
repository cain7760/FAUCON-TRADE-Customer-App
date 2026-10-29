import { positionMarginInCny } from './positionCurrency.js'
import { activeOrderStatuses, averageFillPrice, canceledValue, filledAmount, frozenMargin } from './orderCalculations.js'

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
const numericKeys = new Set(['opening', 'available', 'marginRate', 'floatingProfit', 'filledQuantity', 'filledPrice', 'frozenMargin', 'reportQuantity'])
export function nextTableSort(sort, key) {
  return sort.key !== key ? { key, direction: 'ascending' }
    : sort.direction === 'ascending' ? { key, direction: 'descending' } : { key: '', direction: 'none' }
}
export function tableSortValue(kind, column, row) {
  switch (column.key) {
    case 'price': return kind === 'positions' ? row.cost : row.price
    case 'holdingQty': return row.qty
    case 'opening': return row.opening ?? 0
    case 'valueWan': return row.value
    case 'marginOccupied': return positionMarginInCny(row)
    case 'filledAmount': return kind === 'orders' ? filledAmount(row) : row.filledAmount
    case 'filledPrice': return averageFillPrice(row)
    case 'frozenMargin': return row.side === 'buy' && row.marginRate != null && activeOrderStatuses.has(row.status) ? frozenMargin(row) : null
    case 'fillProgress': return row.quantity > 0 ? Math.min(1, Math.max(0, row.filledQuantity / row.quantity)) : null
    case 'orderTime': return row.orderTime
    case 'filledTime': return row.filledTime
    // 同列包含股数/金额时先按单位分组，避免把 100 元与 100 股直接比较。
    case 'orderValueNumber': return row.inputAmount != null ? [1, row.orderValueNumber ?? row.inputAmount] : [0, row.quantity]
    case 'canceledValue': return [row.inputAmount != null ? 1 : 0, canceledValue(row)]
    default: return numericKeys.has(column.key) ? row[column.key] : column.value(row)
  }
}
const empty = value => value == null || value === '' || value === '--' || (typeof value === 'number' && !Number.isFinite(value))
export function sortTableRecords(records, kind, column, direction) {
  if (!column || !['ascending', 'descending'].includes(direction)) return records
  const sign = direction === 'ascending' ? 1 : -1
  return records.map((row, index) => ({ row, index, value: tableSortValue(kind, column, row) })).sort((a, b) => {
    let left = a.value, right = b.value
    const leftValue = Array.isArray(left) ? left[1] : left, rightValue = Array.isArray(right) ? right[1] : right
    if (empty(leftValue) || empty(rightValue)) return Number(empty(leftValue)) - Number(empty(rightValue)) || a.index - b.index
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left[0] !== right[0]) return left[0] - right[0]
      left = left[1]; right = right[1]
    }
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left), String(right))
    return sign * comparison || a.index - b.index
  }).map(item => item.row)
}
