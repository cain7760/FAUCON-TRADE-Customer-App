<script setup>
import { computed, ref, useId, watch } from 'vue'
import { accountLabel, activityText, fillProgress, formatNumber, listTabs, orderPrice, orderQuantity, pnlClass, price, sideLabel } from './model.js'
import { positionMarginInCny } from './positionCurrency.js'

const props = defineProps({ kind: { type: String, required: true }, records: { type: Array, required: true } })
const emit = defineEmits(['open', 'action'])
const tableId = useId()
const symbolColumnWidth = 92
const expandedRecordId = ref(null)
// 暂时隐藏表格追单入口，保留实现以便恢复。
const isChaseActionVisible = false
watch([() => props.kind, () => props.records], () => { expandedRecordId.value = null })
function handleRecordClick(record, index, event) {
  if (props.kind === 'positions') {
    expandedRecordId.value = expandedRecordId.value === record.id ? null : record.id
  } else {
    emit('open', { record, index: index + 1, event })
  }
}
function collapseActions(event) {
  event.currentTarget.previousElementSibling?.querySelector('button')?.focus()
  expandedRecordId.value = null
}
const label = computed(() => listTabs.find(tab => tab.key === props.kind)?.label)
const timeLabel = value => value ? String(value).slice(-8) : '--'
const columns = computed(() => {
  // Customer PositionsTable + columnOptions：总盈亏、实现盈亏不属于当前可选表格列。
  if (props.kind === 'positions') return [
    { key: 'index', title: '序号', width: 36, value: (row, index) => index + 1 },
    { key: 'price', title: '持仓均价', secondTitle: '最新价', width: 68, value: row => price(row.cost, row.market), second: row => price(row.price, row.market), secondTone: row => pnlClass(row.change) },
    { key: 'opening', title: '期初数量', secondTitle: '（股）', width: 76, value: row => formatNumber(row.opening ?? 0, 3, false) },
    { key: 'holdingQty', title: '持仓数量', secondTitle: '（股）', width: 76, value: row => formatNumber(row.qty, 3, false) },
    { key: 'available', title: '可用数量', secondTitle: '（股）', width: 76, value: row => formatNumber(row.available, 3, false), tone: () => 'equity-accent' },
    { key: 'valueWan', title: '市值', width: 92, value: row => formatNumber(row.value) },
    { key: 'marginOccupied', title: '保证金占用(CNY)', width: 120, value: row => formatNumber(positionMarginInCny(row)) },
    { key: 'marginRate', title: '保证金率', width: 64, value: row => row.marginRate == null || !Number.isFinite(Number(row.marginRate)) ? '--' : `${formatNumber(row.marginRate)}%` },
    { key: 'floatingProfit', title: '浮动盈亏', width: 84, value: row => formatNumber(row.floatingProfit), tone: row => row.floatingProfit >= 0 ? 'equity-positive' : 'equity-negative' },
    { key: 'account', title: '下单账户', width: 120, text: true, value: row => accountLabel(row.account) },
    { key: 'market', title: '市场', width: 44, text: true, value: row => ({ SZ: '深市', SH: '沪市', HK: '港股', US: '美股', A: 'A股' }[row.market] || row.market || '--') },
    { key: 'currency', title: '币种', width: 44, text: true, value: row => row.currency },
    { key: 'direction', title: '多空方向', width: 56, text: true, value: row => row.direction === '多' ? '做多' : '做空', tone: row => ['record-tag', row.direction === '多' ? 'record-tag-long' : 'record-tag-short'] },
    { key: 'orderRemark', title: '下单备注', width: 132, text: true, wrap: true, value: row => row.orderRemark || '--' },
    { key: 'traderRemark', title: '交易员备注', width: 132, text: true, wrap: true, value: row => row.traderRemark || '--' },
  ]
  const context = { key: 'context', title: '交易方向', secondTitle: '订单类型', width: 76, text: true, value: sideLabel, second: row => row.orderType, tone: row => row.side === 'buy' ? 'equity-positive' : 'equity-negative' }
  const account = { key: 'account', title: '下单账户', width: 120, text: true, value: row => accountLabel(row.account) }
  if (props.kind === 'orders') return [
    { key: 'status', title: '订单状态', secondTitle: '成交进度', width: 112, text: true, secondNumeric: true, value: row => row.status, second: fillProgress, tone: row => ['被拒绝', '审核拒绝'].includes(row.status) ? 'equity-positive' : row.status === '全成' ? 'equity-negative' : '' },
    { key: 'price', title: '订单限价', secondTitle: '成交均价', width: 72, value: orderPrice, second: row => price(row.filledPrice, row.market) },
    { key: 'quantity', title: '订单数量 / 金额', width: 112, value: orderQuantity },
    { key: 'filledQuantity', title: '已成数量（股）', width: 92, value: row => row.filledQuantity ? formatNumber(row.filledQuantity, 3, false) : '--' },
    context, account,
    { key: 'time', title: '订单时间', width: 132, value: row => row.orderTime || '--' },
    { key: 'reportQuantity', title: '挂单数量（股）', width: 92, value: row => row.reportQuantity ? formatNumber(row.reportQuantity, 3, false) : '--' },
  ]
  // Customer TradesTable / tradeColumnOptions 的完整业务字段，标的名称与代码仍合并固定。
  return [
    { key: 'index', title: '序号', width: 36, value: (row, index) => index + 1 },
    { key: 'side', title: '方向', width: 44, text: true, value: row => row.side === 'buy' ? '买' : '卖', tone: row => row.side === 'buy' ? 'equity-positive' : 'equity-negative' },
    { key: 'filledPrice', title: '成交均价', width: 72, value: row => price(row.filledPrice, row.market) },
    { key: 'filledQuantity', title: '成交数量', secondTitle: '（股）', width: 92, value: row => formatNumber(row.filledQuantity ?? 0, 3, false) },
    { key: 'filledAmount', title: '成交金额', width: 120, value: row => formatNumber(row.filledAmount) },
    { key: 'filledTime', title: '成交时间', width: 76, value: row => timeLabel(row.filledTime) },
    { key: 'orderTime', title: '订单时间', width: 76, value: row => timeLabel(row.orderTime) },
    { key: 'tradeNo', title: '成交编号', width: 120, value: row => row.tradeNo || '--' },
    { key: 'entrustNo', title: '订单编号', width: 144, value: row => row.entrustNo || '--' },
    { key: 'tradeDate', title: '交易日期', width: 80, value: row => row.tradeDate || '--' },
    account,
    { key: 'market', title: '市场', width: 44, text: true, value: row => row.market === 'HK' ? '港股' : 'A股' },
    { key: 'currency', title: '币种', width: 44, text: true, value: row => row.currency || (row.market === 'HK' ? 'HKD' : row.market === 'US' ? 'USD' : 'CNY') },
    { key: 'orderType', title: '订单类型', width: 64, text: true, value: row => row.orderType || '--' },
    { key: 'algorithm', title: '执行算法', width: 60, text: true, value: row => row.algorithm || '--' },
    { key: 'orderRemark', title: '下单备注', width: 132, text: true, truncate: true, value: row => row.orderRemark || '--' },
    { key: 'feedback', title: '订单动态', width: 180, text: true, truncate: true, value: activityText },
    { key: 'openClose', title: '开平方向', width: 64, text: true, value: row => row.openClose === '开' ? '开仓' : '平仓' },
  ]
})
const tableWidth = computed(() => symbolColumnWidth + columns.value.reduce((sum, column) => sum + column.width, 0))
</script>

<template>
  <div class="equity-table-view">
    <div class="equity-table-scroll" role="region" :aria-label="`${label}表格，可横向滚动，标的列固定`" tabindex="0">
      <table class="equity-data-table" :class="{ 'is-positions': kind === 'positions' }" :style="{ width: `${tableWidth}px` }" :aria-label="label">
        <colgroup><col :style="{ width: `${symbolColumnWidth}px` }"><col v-for="column in columns" :key="column.key" :style="{ width: `${column.width}px` }"></colgroup>
        <thead>
          <tr>
            <th scope="col" class="table-symbol">标的<span class="table-header-secondary">名称 / 代码</span></th>
            <th v-for="column in columns" :key="column.key" scope="col" :class="{ 'table-text-cell': column.text }">{{ column.title }}<span v-if="column.secondTitle" class="table-header-secondary">{{ column.secondTitle }}</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(record, index) in records" :key="record.id">
          <tr :class="{ 'is-expanded': expandedRecordId === record.id }" @click="kind === 'positions' && handleRecordClick(record, index, $event)">
            <th scope="row" class="table-symbol">
              <button type="button" class="table-detail-trigger" :aria-label="kind === 'positions' ? `${expandedRecordId === record.id ? '收起' : '展开'}${record.name}持仓操作` : `查看${record.name}${kind === 'orders' ? '订单' : '成交'}详情`" :aria-expanded="kind === 'positions' ? expandedRecordId === record.id : undefined" :aria-controls="expandedRecordId === record.id ? `${tableId}-${record.id}-actions` : undefined" @click.stop="handleRecordClick(record, index, $event)">
                <span class="table-symbol-name">{{ record.name }}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></span>
                <span class="table-symbol-code app-numeric">{{ record.code }}.{{ record.market }}</span>
              </button>
            </th>
            <td v-for="column in columns" :key="column.key" :class="[column.text ? 'table-text-cell' : 'app-numeric', { 'table-wrap-cell': column.wrap, 'table-truncate-cell': column.truncate }]" :title="column.truncate ? column.value(record, index) : undefined">
              <span :class="column.tone?.(record)">{{ column.value(record, index) }}</span>
              <span v-if="column.second" class="table-cell-secondary" :class="[column.secondTone?.(record), { 'app-numeric': column.secondNumeric }]">{{ column.second(record) }}</span>
            </td>
          </tr>
          <tr v-if="kind === 'positions' && expandedRecordId === record.id" :id="`${tableId}-${record.id}-actions`" class="table-actions-row" @keydown.esc.stop.prevent="collapseActions">
            <td :colspan="columns.length + 1">
              <div class="table-expanded-actions" role="group" :aria-label="`${record.name}持仓操作`">
                <div v-if="record.direction === '多'" class="record-actions">
                  <button v-if="isChaseActionVisible" type="button" class="record-action record-action-chase" :aria-label="`${record.name}追单`" @click="$emit('action', { record, action: 'chase', event: $event })"><span>追单</span></button>
                  <button type="button" class="record-action record-action-close" :aria-label="`${record.name}平仓`" @click="$emit('action', { record, action: 'close', event: $event })"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4v16h6M9 12h11m-4-4 4 4-4 4"/></svg>平仓</span></button>
                </div>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.equity-table-view { display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 0 12px; container-type: inline-size; }
.equity-table-scroll { min-height: 0; flex: 1; overflow: auto; padding-bottom: var(--equity-order-clearance, 0px); scroll-padding-bottom: var(--equity-order-clearance, 0px); border: 1px solid var(--app-color-border); border-radius: 3px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--app-color-frame) var(--app-color-surface); }
.equity-table-scroll:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.equity-data-table { table-layout: fixed; border-spacing: 0; border-collapse: separate; color: var(--app-color-text); text-align: right; }
th, td { padding: 4px 6px; border-bottom: 1px solid var(--app-color-border); background: var(--app-color-card); vertical-align: middle; }
thead th { position: sticky; top: 0; z-index: 2; height: 40px; padding-block: 2px; line-height: 16px; background: var(--app-color-control); color: var(--app-color-text-secondary); font-size: 11px; font-weight: 400; }
tbody td { font-size: 13px; line-height: 18px; white-space: nowrap; }
tbody tr:last-child > * { border-bottom: 0; }
.table-symbol { position: sticky; left: 0; z-index: 1; padding: 0; border-right: 1px solid var(--app-color-frame); box-shadow: 4px 0 6px -5px #000; text-align: left; }
thead .table-symbol { z-index: 3; padding: 2px 6px; }
.table-header-secondary { display: block; margin-top: 2px; }
.table-detail-trigger { display: block; width: 100%; min-height: 44px; padding: 4px 6px; border: 0; background: none; color: inherit; text-align: left; }
.table-detail-trigger:active { background: var(--app-color-control); }
.table-detail-trigger:focus-visible { outline-offset: -3px; }
.table-symbol-name { display: flex; align-items: center; justify-content: space-between; gap: 2px; font-size: 13px; font-weight: 700; line-height: 18px; }
.table-symbol-name svg { width: 12px; height: 12px; flex-shrink: 0; fill: none; stroke: var(--app-color-text-secondary); stroke-width: 1.2; }
.table-symbol-code { display: block; margin-top: 2px; color: var(--app-color-text-secondary); font-size: 11px; font-weight: 400; line-height: 16px; }
.table-cell-secondary { display: block; color: var(--app-color-text-secondary); font-size: 11px; }
.table-cell-secondary.equity-positive { color: var(--app-color-rise); }
.table-cell-secondary.equity-negative { color: var(--app-color-fall); }
.table-cell-secondary.equity-accent { color: var(--app-color-accent); }
.table-text-cell { text-align: left; }
td.table-text-cell { font-size: 10px; }
td.table-wrap-cell { white-space: normal; overflow-wrap: anywhere; }
td.table-truncate-cell > span { display: block; overflow: hidden; text-overflow: ellipsis; }
td .record-tag { font-size: 9px; }
.is-positions tbody tr:not(.table-actions-row) { cursor: pointer; }
.is-positions .is-expanded > * { background: var(--app-color-control); }
.table-detail-trigger[aria-expanded="true"] svg { transform: rotate(90deg); }
.is-positions .table-actions-row > td { padding: 0; background: var(--app-color-control); }
/* 展开栏跟随表格可视容器宽度，横向滚动时按钮仍留在当前行下方。 */
.table-expanded-actions { position: sticky; left: 0; display: flex; width: calc(100cqw - 2px); align-items: center; justify-content: center; gap: 8px; padding: 0 8px; }
.table-expanded-actions .record-action { display: flex; min-width: 160px; min-height: 44px; align-items: center; padding: 6px 0; border: 0; border-radius: 2px; background: none; font-size: 10px; font-weight: 500; }
.table-expanded-actions button > span { display: flex; width: 100%; min-height: 32px; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; border: 1px solid transparent; border-radius: 2px; }
.table-expanded-actions .record-action-close > span { background: color-mix(in srgb, var(--app-color-sell) 88%, #000); }
.table-expanded-actions svg { width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.table-expanded-actions button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-expanded-actions button:active { opacity: .7; }
</style>
