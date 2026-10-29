// 只在数量单元格使用；不处理金额、表头或交易表单。
export function withoutShareUnit(value) {
  return typeof value === 'string' ? value.replace(/\s*股(?=\s*(?:$|[、/]))/g, '') : value
}
