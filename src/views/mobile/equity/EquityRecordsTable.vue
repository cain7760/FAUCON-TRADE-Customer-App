<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { fillProgress, listTabs } from './model.js'
import { recordTableColumns } from './recordTableColumns.js'
import { nextTableSort, sortTableRecords } from './tableSorting.js'
import EquityOrderStatus from './EquityOrderStatus.vue'
import EquityOrderActions from './EquityOrderActions.vue'
import { resolveFocusColumns, sortFocusRecords } from './focusTableColumns.js'

const props = defineProps({ kind: { type: String, required: true }, records: { type: Array, required: true }, design: { type: String, default: 'baseline' }, detailOnClick: Boolean, columnKeys: { type: Array, default: null }, columnWidths: { type: Object, default: null }, selectedRecordId: { type: String, default: null }, systemRunning: { type: Boolean, default: true }, readonly: Boolean, customColumns: { type: Array, default: null }, sortState: { type: Object, default: null }, labelOverride: { type: String, default: '' }, fixedColumnCount: { type: Number, default: 1 } })
const emit = defineEmits(['open', 'action', 'order-change', 'sort-change'])
const tableId = useId()
const symbolColumnWidth = computed(() => props.columnWidths?.symbol ?? (props.design === 'baseline' ? 96 : props.kind === 'orders' ? 76 : 84))
const isConfigured = computed(() => props.columnKeys !== null)
const useContentColumnWidths = computed(() => props.design === 'baseline' && !isConfigured.value && !props.columnWidths)
const isLedgerTable = computed(() => ['orders', 'trades'].includes(props.kind))
const hasSymbolColumn = computed(() => !isConfigured.value || isLedgerTable.value)
const hasHistoryColumn = computed(() => !props.readonly && isLedgerTable.value)
const hasExpandableActions = computed(() => !props.readonly && (props.kind === 'orders' || (!props.detailOnClick && props.kind === 'positions')))
const expandedRecordId = ref(null)
const tableElement = ref(null), accountColumnWidth = ref(60)
// 列间留白同时计入固定列宽，避免挤占已有文字及排序图标。
const columns = computed(() => {
  const source = props.customColumns ?? (isConfigured.value ? resolveFocusColumns(props.kind, props.columnKeys) : recordTableColumns(props.kind, props.design))
  // 移动端委托/成交复用持仓的固定标的列；底层字段及导出契约不变。
  const fields = isLedgerTable.value ? source.filter(column => !['index', 'code', 'name'].includes(column.key)) : source
  return fields.map(column => ({ ...column, width: (column.key === 'account' ? accountColumnWidth.value : props.columnWidths?.[column.key] ?? column.width) + (column.gapBefore || 0) }))
})
function fitAccountColumn() {
  if (useContentColumnWidths.value) return
  const cells = tableElement.value?.querySelectorAll('th.table-account-cell .table-sort-button > span, td.table-account-cell > span')
  if (!cells?.length || !tableElement.value.getClientRects().length) return
  // 按实际字体测量完整名称；表头另计排序图标及间距，单元格另计左右留白。
  accountColumnWidth.value = Math.ceil(Math.max(60, ...[...cells].map(cell => cell.getBoundingClientRect().width + (cell.closest('th') ? 12 : 8))))
}
let tableObserver
onMounted(() => {
  fitAccountColumn()
  tableObserver = new ResizeObserver(fitAccountColumn)
  tableObserver.observe(tableElement.value)
  document.fonts?.ready.then(fitAccountColumn)
})
onBeforeUnmount(() => tableObserver?.disconnect())
watch(() => props.records, fitAccountColumn, { flush: 'post' })
watch(() => props.columnKeys, fitAccountColumn, { flush: 'post' })
const sort = ref({ key: '', direction: 'none' })
const activeSort = computed(() => props.sortState || sort.value)
const symbolSortColumn = { key: 'name', value: row => row.name }
const sortedRecords = computed(() => {
  const rows = props.sortState ? props.records : (isConfigured.value ? sortFocusRecords : sortTableRecords)(props.records, props.kind, activeSort.value.key === 'name' ? symbolSortColumn : columns.value.find(column => column.key === activeSort.value.key), activeSort.value.direction)
  return props.kind === 'orders' && !props.readonly ? [...rows.filter(row => row.status === '异常'), ...rows.filter(row => row.status !== '异常')] : rows
})
watch([sortedRecords, isConfigured], ([rows, configured]) => { if (configured) emit('order-change', rows.map(row => row.id)) }, { immediate: true, flush: 'sync' })
watch(() => props.kind, () => { sort.value = { key: '', direction: 'none' } })
function sortBy(key) { const next = nextTableSort(activeSort.value, key); if (props.sortState) emit('sort-change', next); else sort.value = next; expandedRecordId.value = null }
const sortDirection = key => activeSort.value.key === key ? activeSort.value.direction || 'none' : 'none'
const progressPercent = record => Number.parseFloat(fillProgress(record))
const sortLabel = (key, title) => `${title}，${activeSort.value.key !== key || !activeSort.value.direction || activeSort.value.direction === 'none' ? '升序排序' : activeSort.value.direction === 'ascending' ? '降序排序' : '恢复默认顺序'}`
// 暂时隐藏表格追单入口，保留实现以便恢复。
const isChaseActionVisible = false
watch([() => props.kind, () => props.records], () => { expandedRecordId.value = null })
function handleRecordClick(record, index, event) {
  if (props.readonly) return
  if (hasExpandableActions.value) {
    expandedRecordId.value = expandedRecordId.value === record.id ? null : record.id
  } else {
    emit('open', { record, index: index + 1, event })
  }
}
function actionLabel(record) { return `${record.name}${props.kind === 'orders' ? `订单操作 ${record.orderNo}` : '持仓操作'}` }
function collapseActions(event) {
  event.currentTarget.previousElementSibling?.querySelector('button')?.focus()
  expandedRecordId.value = null
}
const label = computed(() => props.labelOverride || listTabs.find(tab => tab.key === props.kind)?.label)
function fixedColumnStyle(index) {
  if (hasSymbolColumn.value || index >= props.fixedColumnCount) return {}
  return { left: `${columns.value.slice(0, index).reduce((width, column) => width + column.width, 0)}px` }
}
const tableWidth = computed(() => (hasSymbolColumn.value ? symbolColumnWidth.value : 0) + columns.value.reduce((sum, column) => sum + column.width, 0) + (hasHistoryColumn.value ? 48 : 0))
</script>

<template>
  <div class="equity-table-view" :class="{ 'equity-table-view--baseline': design === 'baseline' }">
    <div class="equity-table-scroll" :class="{ 'is-order-scroll': kind === 'orders', 'is-position-scroll': kind === 'positions' && !detailOnClick }" role="region" :aria-label="`${label}表格，可横向滚动，${hasSymbolColumn ? '标的列' : fixedColumnCount > 1 ? `前${fixedColumnCount}列` : '首列'}固定${hasExpandableActions ? '，点击行展开操作' : ''}`" tabindex="0">
      <p v-if="isConfigured && !columns.length" class="table-no-columns">未选择展示列，请在更多操作中自定义表格列。</p>
      <table ref="tableElement" class="equity-data-table" :class="{ 'is-positions': kind === 'positions', 'is-orders': kind === 'orders', 'is-configured': isConfigured, 'is-content-sized': useContentColumnWidths }" :style="{ width: useContentColumnWidths ? 'max-content' : `${tableWidth}px` }" :aria-label="label">
        <colgroup><col v-if="hasSymbolColumn" :style="{ width: `${symbolColumnWidth}px` }"><col v-for="column in columns" :key="column.key" :style="{ width: useContentColumnWidths ? undefined : `${column.width}px` }"><col v-if="hasHistoryColumn" :style="{ width: useContentColumnWidths ? undefined : '48px' }"></colgroup>
        <thead>
          <tr>
            <th v-if="hasSymbolColumn" scope="col" class="table-symbol" :style="{ minWidth: `${symbolColumnWidth}px` }" :aria-sort="sortDirection('name')"><button type="button" class="table-sort-button" :aria-label="sortLabel('name', '标的名称')" @click="sortBy('name')"><span>{{ design === 'baseline' ? '标的名称' : '标的' }}<span class="table-header-secondary">{{ design === 'baseline' ? '代码' : '名称 / 代码' }}</span></span><i class="table-sort-indicator" aria-hidden="true"><i class="ascending" :class="{ 'is-active': sortDirection('name') === 'ascending' }"></i><i class="descending" :class="{ 'is-active': sortDirection('name') === 'descending' }"></i></i></button></th>
            <th v-for="(column, columnIndex) in columns" :key="column.key" scope="col" :class="{ 'table-text-cell': column.text, 'table-progress-cell': column.key === 'fillProgress', 'table-account-cell': column.key === 'account', 'table-configured-first': !hasSymbolColumn && columnIndex < fixedColumnCount }" :style="{ ...fixedColumnStyle(columnIndex), minWidth: useContentColumnWidths ? undefined : `${column.width}px`, '--table-column-gap-before': `${column.gapBefore || 0}px` }" :aria-sort="column.key === 'index' ? undefined : sortDirection(column.key)">
              <slot :name="`header-${column.key}`" :column="column"><template v-if="column.key === 'index'">{{ column.title }}</template>
              <button v-else type="button" class="table-sort-button" :aria-label="sortLabel(column.key, column.title)" @click="sortBy(column.key)"><span>{{ column.title }}<span v-if="column.secondTitle" class="table-header-secondary">{{ column.secondTitle }}</span></span><i class="table-sort-indicator" aria-hidden="true"><i class="ascending" :class="{ 'is-active': sortDirection(column.key) === 'ascending' }"></i><i class="descending" :class="{ 'is-active': sortDirection(column.key) === 'descending' }"></i></i></button></slot>
            </th>
            <th v-if="hasHistoryColumn" scope="col" class="table-history-cell">历史</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(record, index) in sortedRecords" :key="record.id">
          <tr :class="{ 'is-expanded': expandedRecordId === record.id, 'is-selected': selectedRecordId === record.id, 'is-exception': kind === 'orders' && record.status === '异常' }" @click="(hasExpandableActions || detailOnClick) && handleRecordClick(record, index, $event)">
            <th v-if="hasSymbolColumn" scope="row" class="table-symbol">
              <button v-if="!readonly" type="button" class="table-detail-trigger" :aria-label="hasExpandableActions ? `${expandedRecordId === record.id ? '收起' : '展开'}${actionLabel(record)}` : `查看${record.name}${kind === 'positions' ? '持仓' : kind === 'orders' ? '订单' : '成交'}详情`" :aria-expanded="hasExpandableActions ? expandedRecordId === record.id : undefined" :aria-controls="expandedRecordId === record.id ? `${tableId}-${record.id}-actions` : undefined" @click.stop="handleRecordClick(record, index, $event)">
                <span class="table-symbol-name">{{ record.name }}</span>
                <span class="table-symbol-code app-numeric">{{ record.code }}.{{ record.market }}</span>
              </button>
              <div v-else class="table-detail-trigger"><span class="table-symbol-name">{{ record.name }}</span><span class="table-symbol-code app-numeric">{{ record.code }}.{{ record.market }}</span></div>
            </th>
            <td v-for="(column, columnIndex) in columns" :key="column.key" :class="[column.text ? 'table-text-cell' : 'app-numeric', { 'table-progress-cell': column.key === 'fillProgress', 'table-readable-cell': column.readable, 'table-wrap-cell': column.wrap, 'table-truncate-cell': column.truncate, 'table-account-cell': column.key === 'account', 'table-configured-first': !hasSymbolColumn && columnIndex < fixedColumnCount }]" :style="{ ...fixedColumnStyle(columnIndex), '--table-column-gap-before': `${column.gapBefore || 0}px` }" :title="column.truncate ? column.value(record, index) : undefined">
              <button v-if="!readonly && !hasSymbolColumn && columnIndex === 0" type="button" class="table-configured-trigger" :aria-label="`查看${record.name}${kind === 'positions' ? '持仓' : kind === 'orders' ? '订单' : '成交'}详情`" @click.stop="handleRecordClick(record, index, $event)"><span :class="column.tone?.(record)">{{ column.value(record, index) }}</span><span v-if="column.second" class="table-cell-secondary" :class="column.secondTone?.(record)">{{ column.second(record) }}</span></button>
              <template v-else><EquityOrderStatus v-if="column.key === 'status'" :status="record.status" /><template v-else-if="column.key === 'fillProgress'"><span v-if="Number.isFinite(progressPercent(record))" class="order-fill-progress" role="progressbar" aria-label="成交进度" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progressPercent(record)" :aria-valuetext="fillProgress(record)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="order-fill-progress-track" cx="12" cy="12" r="9"/><circle class="order-fill-progress-value" cx="12" cy="12" r="9" pathLength="100" :stroke-dasharray="`${progressPercent(record)} 100`"/></svg><span>{{ fillProgress(record) }}</span></span><span v-else>--</span></template><slot v-else :name="`cell-${column.key}`" :record="record" :index="index"><span :class="column.tone?.(record)">{{ column.value(record, index) }}</span><span v-if="column.second" class="table-cell-secondary" :class="[column.secondTone?.(record), { 'app-numeric': column.secondNumeric }]">{{ column.second(record) }}</span></slot></template>
            </td>
            <td v-if="hasHistoryColumn" class="table-history-cell"><button type="button" class="table-history-button" :aria-label="`查看${record.name}${kind === 'trades' ? '成交' : '订单'}历史 ${record.orderNo}`" @click.stop="$emit('action', { record, action: 'history', event: $event })"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>查看</button></td>
          </tr>
          <tr v-if="hasExpandableActions && expandedRecordId === record.id" :id="`${tableId}-${record.id}-actions`" class="table-actions-row" @keydown.esc.stop.prevent="collapseActions">
            <td :colspan="columns.length + (hasSymbolColumn ? 1 : 0) + (hasHistoryColumn ? 1 : 0)">
              <div class="table-expanded-actions" :class="{ 'table-expanded-actions--position': kind === 'positions' && record.direction === '多', 'table-expanded-actions--order': kind === 'orders' }" role="group" :aria-label="actionLabel(record)">
                <template v-if="kind === 'orders'">
                  <EquityOrderActions :record="record" :system-running="systemRunning" :stacked="design === 'baseline'" @action="emit('action', $event)">
                    <button v-if="design === 'baseline'" type="button" class="table-order-detail" :aria-label="`查看${record.name}订单详情 ${record.orderNo}`" @click.stop="emit('open', { record, index: index + 1, event: $event })"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>详情</button>
                  </EquityOrderActions>
                  <button v-if="design !== 'baseline'" type="button" class="table-order-detail" :aria-label="`查看${record.name}订单详情 ${record.orderNo}`" @click.stop="emit('open', { record, index: index + 1, event: $event })">详情</button>
                </template>
                <div v-if="kind === 'positions' && record.direction === '多'" class="record-actions table-position-actions">
                  <button type="button" class="record-action record-action-detail" :aria-label="`查看${record.name}持仓详情`" @click.stop="emit('open', { record, index: index + 1, event: $event })"><span><span class="record-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span>详情</span></button>
                  <button v-if="isChaseActionVisible" type="button" class="record-action record-action-chase" :aria-label="`${record.name}追单`" @click="$emit('action', { record, action: 'chase', event: $event })"><span>追单</span></button>
                  <button type="button" class="record-action record-action-close" :aria-label="`${record.name}平仓`" @click="$emit('action', { record, action: 'close', event: $event })"><span><span class="record-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 12h8"/></svg></span>平仓</span></button>
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
.equity-table-view { display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 0; container-type: inline-size; }
.equity-table-scroll { min-height: 0; flex: 1; overflow: auto; padding-bottom: var(--equity-order-clearance, 0px); scroll-padding-bottom: var(--equity-order-clearance, 0px); border: 1px solid var(--app-color-border); border-radius: 3px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--app-color-frame) var(--app-color-surface); }
.equity-table-scroll:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.equity-table-scroll.is-order-scroll { scroll-padding-inline: 76px 0; }
.equity-table-scroll.is-position-scroll { border: 0; }
.equity-data-table { table-layout: auto; border-spacing: 0; border-collapse: separate; color: var(--app-color-text); font-size: 12px; text-align: right; }
th, td { padding: 4px; padding-inline-start: calc(4px + var(--table-column-gap-before, 0px)); border-bottom: 1px solid var(--app-color-border); background: var(--app-color-card); font-size: inherit; vertical-align: middle; }
thead th { position: sticky; top: 0; z-index: 2; height: 44px; padding: 0 4px; padding-inline-start: calc(4px + var(--table-column-gap-before, 0px)); line-height: 16px; background: var(--app-color-control); color: var(--app-color-text-secondary); font-weight: 400; }
tbody td { line-height: 18px; overflow-wrap: anywhere; }
.table-sort-button { display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: flex-end; gap: 2px; padding: 2px 0; border: 0; background: transparent; color: inherit; font: inherit; line-height: 16px; text-align: inherit; }
.table-sort-button > span { flex-shrink: 0; white-space: nowrap; overflow-wrap: normal; }
/* 对齐 Customer variants.css 最终 caret-wrapper / sort-caret：上下实心三角。 */
.table-sort-indicator { display: grid; grid-template-columns: 100%; grid-template-rows: 3px 3px; row-gap: 3px; place-content: center; width: 6px; height: 12px; flex: 0 0 6px; }
.table-sort-indicator > i { display: block; width: 100%; height: 100%; border: 0; border-radius: 1px; background: #7f8793; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.table-sort-indicator .descending { transform: rotate(180deg); }
.table-sort-indicator .is-active { background: var(--app-color-accent); }
thead th:not(.table-text-cell):not(.table-symbol) .table-sort-indicator { width: 7px; flex-basis: 7px; grid-template-rows: 4px 4px; }
.table-sort-button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-sort-button:active { color: var(--app-color-accent); }
tbody tr:last-child > * { border-bottom: 0; }
.table-symbol { position: sticky; left: 0; z-index: 1; padding: 0; text-align: left; }
.table-configured-first { position: sticky; left: 0; z-index: 1; }
thead .table-configured-first { z-index: 3; }
.table-configured-trigger { width: 100%; min-height: 44px; padding: 4px 0; border: 0; background: none; color: inherit; font: inherit; text-align: inherit; }
.table-configured-trigger:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-no-columns { margin: 0; padding: 20px 16px; color: var(--app-color-text-secondary); font-size: 13px; line-height: 20px; }
thead .table-symbol { z-index: 3; padding: 0 4px; }
.is-position-scroll thead .table-symbol { padding-inline-start: 12px; padding-inline-end: 0; }
thead .table-symbol .table-sort-button { justify-content: space-between; }
.table-header-secondary { display: block; margin-top: 2px; }
.table-detail-trigger { display: block; width: 100%; min-height: 44px; padding: 4px; border: 0; background: none; color: inherit; font-size: inherit; text-align: left; }
.is-position-scroll .table-detail-trigger { padding-inline-start: 12px; padding-inline-end: 0; }
.table-detail-trigger:active { background: var(--app-color-control); }
.table-detail-trigger:focus-visible { outline-offset: -3px; }
.table-symbol-name { display: block; font-size: inherit; font-weight: 600; line-height: 18px; white-space: nowrap; }
.table-symbol-code { display: block; margin-top: 2px; color: var(--app-color-text-secondary); font-size: inherit; font-weight: 400; line-height: 16px; }
.table-cell-secondary { display: block; color: var(--app-color-text-secondary); font-size: inherit; }
.equity-data-table tbody tr.is-exception > :is(td, th) { background: #302529; }
.equity-table-view--baseline .equity-data-table tbody tr.is-exception > :is(td, th) { background: #302529; }
.equity-data-table tbody tr.is-exception { --table-row-surface: #302529; }
.table-cell-secondary.equity-positive { color: var(--app-color-rise); }
.table-cell-secondary.equity-negative { color: var(--app-color-fall); }
.table-cell-secondary.equity-accent { color: var(--app-color-accent); }
.table-text-cell { text-align: left; }
.table-text-cell .table-sort-button { justify-content: flex-start; text-align: left; }
td.app-numeric { white-space: nowrap; overflow-wrap: normal; }
.table-account-cell { white-space: nowrap; overflow-wrap: normal; }
.table-account-cell .table-sort-button { justify-content: flex-start; text-align: left; }
.table-account-cell > span, .table-account-cell .table-sort-button > span { display: inline-block; flex-shrink: 0; white-space: nowrap; overflow-wrap: normal; }
.table-readable-cell .record-status { display: inline-block; padding: 2px 5px; font-size: inherit; line-height: 18px; white-space: nowrap; overflow-wrap: normal; }
td.table-wrap-cell { white-space: normal; overflow-wrap: anywhere; }
td.table-truncate-cell > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
td .record-tag { font-size: inherit; }
:is(.is-positions, .is-orders) tbody tr:not(.table-actions-row) { cursor: pointer; }
:is(.is-positions, .is-orders) .is-expanded > * { background: var(--app-color-control); }
:is(.is-positions, .is-orders) .table-actions-row > td { padding: 0; background: var(--app-color-control); }
/* 展开栏跟随表格可视容器宽度，横向滚动时按钮仍留在当前行下方。 */
.table-expanded-actions { position: sticky; left: 0; display: flex; width: calc(100cqw - 2px); align-items: center; justify-content: center; gap: 8px; padding: 0 8px; }
.table-expanded-actions .record-action { display: flex; min-width: 160px; min-height: 44px; align-items: center; padding: 6px 0; border: 0; border-radius: 2px; background: none; font-size: inherit; font-weight: 500; }
.table-expanded-actions button > span { display: flex; width: 100%; min-height: 32px; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; border: 1px solid transparent; border-radius: 2px; }
.table-expanded-actions--position .record-action-close > span { width: auto; min-height: 36px; gap: 8px; padding: 0 4px; border: 0; border-radius: 0; background: transparent; color: var(--app-color-fall); font-size: 15px; font-weight: 650; }
.table-expanded-actions .record-action-close .record-action-icon { display: grid; width: 28px; height: 28px; flex: 0 0 28px; place-items: center; border: 1px solid color-mix(in srgb, var(--app-color-fall) 58%, transparent); border-radius: 7px; background: color-mix(in srgb, var(--app-color-fall) 26%, transparent); }
.table-expanded-actions .record-action-close svg { width: 18px; height: 18px; }
.table-expanded-actions svg { width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.table-expanded-actions button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-expanded-actions button:active { opacity: .7; }
.table-expanded-actions--position { justify-content: space-between; min-height: 48px; padding: 2px 12px; text-align: left; }
.is-position-scroll .table-expanded-actions { width: 100cqw; }
.is-positions .record-action { min-width: 96px; padding: 4px 0; }
.is-positions .record-action > span { min-height: 36px; padding: 0 16px; border-radius: 4px; }
.is-orders .table-expanded-actions { padding: 8px 12px; }
.table-expanded-actions--order .equity-order-row-actions { flex: 1; }
.table-order-detail { min-width: 64px; min-height: 44px; padding: 0 12px; border: 0; background: transparent; color: var(--app-color-accent); font: inherit; font-size: 12px; cursor: pointer; }
.table-order-detail:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-order-buttons { display: flex; width: 100%; align-items: center; justify-content: center; gap: 8px; }
.table-order-buttons button { display: flex; min-width: 0; max-width: 160px; min-height: 36px; flex: 1; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 0; border-radius: 2px; background: var(--app-color-accent); color: #fff; font: inherit; font-size: 12px; white-space: nowrap; }
.table-order-buttons .table-order-cancel { background: var(--app-color-buy); color: #fff; }
.table-order-buttons button:disabled { color: var(--app-color-text-secondary); opacity: .45; cursor: not-allowed; }
.table-order-buttons button:enabled:active { filter: brightness(.88); }
.table-history-button:active { background: var(--app-color-accent-soft); }
.table-history-button { display: flex; width: 100%; min-height: 36px; align-items: center; justify-content: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--app-color-accent); font: inherit; }
.table-history-button svg { width: 12px; height: 12px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

/* 基线的文字对齐线独立于排序图标；其他评审方案继续使用各自布局。 */
.equity-table-view--baseline { --table-sort-gutter: 10px; --table-column-padding: 14px; --table-row-surface: #0f1012; --table-selected-surface: #1a1c20; }
/* 当日与历史订单收紧列间留白：每侧 8px，避免短方向列后出现过宽间隔。 */
.equity-table-view--baseline .is-orders { --table-column-padding: 8px; }
.equity-table-view--baseline .equity-table-scroll { border: 0; border-radius: 0; }
/* 仅调整表头和数据单元格的层次、分隔线及纵向留白，保留字体与列布局。 */
.equity-table-view--baseline thead th { height: 48px; background: var(--table-header-surface); border-bottom-color: var(--table-row-divider); }
.equity-table-view--baseline tbody tr:not(.table-actions-row) > * { height: 53px; }
.equity-table-view--baseline tbody tr:not(.table-actions-row):not(.is-expanded):not(.is-selected) > * { background: var(--table-row-surface); border-bottom-color: var(--table-row-divider); }
.equity-table-view--baseline thead th { font-size: 12px; }
.equity-table-view--baseline tbody tr:not(.table-actions-row) > td { font-size: 14px; }
.equity-table-view--baseline .is-orders .table-readable-cell .record-status { font-size: 12px; }
.equity-table-view--baseline .is-positions td :is(.record-tag-long, .record-tag-short) { display: inline-flex; min-width: 40px; height: 20px; align-items: center; justify-content: center; padding: 1px 8px; font-size: 12px; line-height: 18px; white-space: nowrap; }
.equity-table-view--baseline thead th:not(.table-text-cell):not(.table-symbol):not(.table-history-cell):not(.table-progress-cell),
.equity-table-view--baseline td.app-numeric:not(.table-progress-cell) { padding-inline-end: calc(4px + var(--table-sort-gutter)); }
.equity-table-view--baseline .table-history-cell { text-align: center; }
.equity-table-view--baseline thead th:not(.table-text-cell):not(.table-symbol):not(.table-progress-cell) .table-sort-button { position: relative; }
.equity-table-view--baseline thead th:not(.table-text-cell):not(.table-symbol):not(.table-progress-cell) .table-sort-indicator { position: absolute; right: calc(-1 * var(--table-sort-gutter)); }
.equity-table-view--baseline th:is([aria-sort="ascending"], [aria-sort="descending"]) .table-sort-button > span { color: var(--app-color-text); }
.equity-table-view--baseline thead .table-symbol,
.equity-table-view--baseline .table-detail-trigger { padding-inline-start: 12px; }
.equity-table-view--baseline td.table-text-cell > :is(.record-status, .record-tag) { margin-inline-start: -5px; }
.equity-table-view--baseline .table-detail-trigger { position: relative; min-height: 48px; }
.equity-table-view--baseline .table-symbol-name { font-size: 13px; }
.equity-table-view--baseline .table-symbol-code { font-size: 11px; }
/* 28px 列间距来自基线价格列与盈亏列的文字间隔；宽度由内容决定，不再分摊固定列宽的余量。 */
.is-content-sized thead th:not(.table-symbol),
.is-content-sized tbody tr:not(.table-actions-row) > td { padding-inline: var(--table-column-padding); }
.is-content-sized thead .table-symbol,
.is-content-sized .table-detail-trigger { padding-inline-end: var(--table-column-padding); }
.is-content-sized td.table-text-cell > :is(.record-status, .record-tag) { margin-inline-start: 0; }
.is-content-sized .table-wrap-cell > span,
.is-content-sized .table-truncate-cell > span { display: block; width: 104px; }
.equity-table-view--baseline :is(.is-expanded, .is-selected) > * { border-bottom-color: var(--table-row-divider); background: var(--table-selected-surface); }
.equity-table-view--baseline .is-expanded > * { border-bottom-color: transparent; }
.equity-table-view--baseline .is-expanded .table-symbol-name { color: var(--app-color-accent); }
.equity-table-view--baseline .table-actions-row > td { background: var(--table-selected-surface); border-bottom-color: var(--table-row-divider); }
.equity-table-view--baseline .table-expanded-actions { width: 100cqw; }
.equity-table-view--baseline .table-expanded-actions::before { position: absolute; top: 0; right: 12px; left: 12px; height: 1px; background: var(--app-color-border); content: ''; }
.equity-table-view--baseline .record-action-close > span { color: var(--app-color-text); font-size: 14px; font-weight: 600; }
.equity-table-view--baseline .record-action-close .record-action-icon { color: var(--app-color-fall); border: 0; background: transparent; border-radius: 0; }
.equity-table-view--baseline .table-expanded-actions--position { min-height: 60px; align-items: stretch; flex-direction: column; gap: 8px; padding: 6px 12px; }
.equity-table-view--baseline .table-position-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.equity-table-view--baseline .table-position-actions .record-action { min-width: 0; min-height: 48px; padding: 0; border-radius: 0; background: transparent; color: var(--app-color-text); }
.equity-table-view--baseline .table-position-actions .record-action > span { width: 100%; height: 48px; min-height: 48px; flex-direction: column; gap: 5px; padding: 3px 12px; border: 0; border-radius: inherit; background: transparent; color: inherit; font-size: 12px; font-weight: 500; }
.equity-table-view--baseline .table-position-actions .record-action-icon { display: grid; width: 18px; height: 18px; min-height: 18px; flex: 0 0 18px; padding: 0; border: 0; border-radius: 0; background: transparent; }
.equity-table-view--baseline .table-position-actions svg { width: 18px; height: 18px; }
.equity-table-view--baseline .is-orders .table-expanded-actions { min-height: 56px; padding: 4px 12px; }
.equity-table-view--baseline .table-order-detail svg { width: 18px; height: 18px; }
@media (hover: hover) {
  .equity-table-view--baseline .table-expanded-actions :is(.record-action-detail, .table-order-detail):enabled:hover { color: var(--app-color-accent); }
}
.equity-table-view--baseline .table-order-buttons { gap: 0; }
.equity-table-view--baseline .table-order-buttons button { min-height: 44px; max-width: none; background: transparent; color: var(--app-color-accent); font-size: 13px; font-weight: 600; }
.equity-table-view--baseline .table-order-buttons .table-order-cancel { position: relative; color: var(--app-color-rise); }
.equity-table-view--baseline .table-order-cancel::before { position: absolute; top: 12px; bottom: 12px; left: 0; width: 1px; background: var(--app-color-border); content: ''; }
.equity-table-view--baseline .table-order-buttons button:disabled { color: var(--app-color-text-secondary); }

/* 与 Customer Web OrderRecords 的圆环进度一致；当日与只读历史共用。 */
.table-progress-cell { text-align: left; }
.table-progress-cell .table-sort-button { justify-content: flex-start; text-align: left; }
.order-fill-progress { display: inline-flex; width: 100%; align-items: center; justify-content: flex-start; gap: 6px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.order-fill-progress svg { width: 20px; height: 20px; flex: none; transform: rotate(-90deg); }
.order-fill-progress circle { fill: none; stroke-width: 2.5; }
.order-fill-progress-track { stroke: #41464e; }
.order-fill-progress-value { stroke: #bb984a; stroke-linecap: round; }
</style>
