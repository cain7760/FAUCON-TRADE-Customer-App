<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { listTabs } from './model.js'
import { recordTableColumns } from './recordTableColumns.js'
import { nextTableSort, sortTableRecords } from './tableSorting.js'
import { canConvertOrder, orderActionReason } from './orderActions.js'

const props = defineProps({ kind: { type: String, required: true }, records: { type: Array, required: true } })
const emit = defineEmits(['open', 'action'])
const tableId = useId()
const symbolColumnWidth = computed(() => props.kind === 'orders' ? 76 : 84)
const hasExpandableActions = computed(() => ['positions', 'orders'].includes(props.kind))
const expandedRecordId = ref(null)
const tableElement = ref(null), accountColumnWidth = ref(60)
const columns = computed(() => recordTableColumns(props.kind).map(column => column.key === 'account' ? { ...column, width: accountColumnWidth.value } : column))
function fitAccountColumn() {
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
const sort = ref({ key: '', direction: 'none' })
const symbolSortColumn = { key: 'name', value: row => row.name }
const sortedRecords = computed(() => sortTableRecords(props.records, props.kind, sort.value.key === 'name' ? symbolSortColumn : columns.value.find(column => column.key === sort.value.key), sort.value.direction))
watch(() => props.kind, () => { sort.value = { key: '', direction: 'none' } })
function sortBy(key) { sort.value = nextTableSort(sort.value, key); expandedRecordId.value = null }
const sortDirection = key => sort.value.key === key ? sort.value.direction : 'none'
const sortLabel = (key, title) => `${title}，${sort.value.key !== key || sort.value.direction === 'none' ? '升序排序' : sort.value.direction === 'ascending' ? '降序排序' : '恢复默认顺序'}`
// 暂时隐藏表格追单入口，保留实现以便恢复。
const isChaseActionVisible = false
watch([() => props.kind, () => props.records], () => { expandedRecordId.value = null })
function handleRecordClick(record, index, event) {
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
const label = computed(() => listTabs.find(tab => tab.key === props.kind)?.label)
const tableWidth = computed(() => symbolColumnWidth.value + columns.value.reduce((sum, column) => sum + column.width, 0) + (props.kind === 'orders' ? 48 : 0))
</script>

<template>
  <div class="equity-table-view">
    <div class="equity-table-scroll" :class="{ 'is-order-scroll': kind === 'orders' }" role="region" :aria-label="`${label}表格，可横向滚动，标的列固定${hasExpandableActions ? '，点击行展开操作' : ''}`" tabindex="0">
      <table ref="tableElement" class="equity-data-table" :class="{ 'is-positions': kind === 'positions', 'is-orders': kind === 'orders' }" :style="{ width: `${tableWidth}px` }" :aria-label="label">
        <colgroup><col :style="{ width: `${symbolColumnWidth}px` }"><col v-for="column in columns" :key="column.key" :style="{ width: `${column.width}px` }"><col v-if="kind === 'orders'" style="width: 48px"></colgroup>
        <thead>
          <tr>
            <th scope="col" class="table-symbol" :aria-sort="sortDirection('name')"><button type="button" class="table-sort-button" :aria-label="sortLabel('name', '标的名称')" @click="sortBy('name')"><span>{{ kind === 'orders' ? '证券名称' : '标的' }}<span v-if="kind !== 'orders'" class="table-header-secondary">名称 / 代码</span></span><i class="table-sort-indicator" aria-hidden="true"><i class="ascending" :class="{ 'is-active': sortDirection('name') === 'ascending' }"></i><i class="descending" :class="{ 'is-active': sortDirection('name') === 'descending' }"></i></i></button></th>
            <th v-for="column in columns" :key="column.key" scope="col" :class="{ 'table-text-cell': column.text, 'table-account-cell': column.key === 'account' }" :aria-sort="column.key === 'index' ? undefined : sortDirection(column.key)">
              <template v-if="column.key === 'index'">{{ column.title }}</template>
              <button v-else type="button" class="table-sort-button" :aria-label="sortLabel(column.key, column.title)" @click="sortBy(column.key)"><span>{{ column.title }}<span v-if="column.secondTitle" class="table-header-secondary">{{ column.secondTitle }}</span></span><i class="table-sort-indicator" aria-hidden="true"><i class="ascending" :class="{ 'is-active': sortDirection(column.key) === 'ascending' }"></i><i class="descending" :class="{ 'is-active': sortDirection(column.key) === 'descending' }"></i></i></button>
            </th>
            <th v-if="kind === 'orders'" scope="col">历史</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(record, index) in sortedRecords" :key="record.id">
          <tr :class="{ 'is-expanded': expandedRecordId === record.id }" @click="hasExpandableActions && handleRecordClick(record, index, $event)">
            <th scope="row" class="table-symbol">
              <button type="button" class="table-detail-trigger" :aria-label="hasExpandableActions ? `${expandedRecordId === record.id ? '收起' : '展开'}${actionLabel(record)}` : `查看${record.name}成交详情`" :aria-expanded="hasExpandableActions ? expandedRecordId === record.id : undefined" :aria-controls="expandedRecordId === record.id ? `${tableId}-${record.id}-actions` : undefined" @click.stop="handleRecordClick(record, index, $event)">
                <span class="table-symbol-name">{{ record.name }}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></span>
                <span v-if="kind !== 'orders'" class="table-symbol-code app-numeric">{{ record.code }}.{{ record.market }}</span>
              </button>
            </th>
            <td v-for="column in columns" :key="column.key" :class="[column.text ? 'table-text-cell' : 'app-numeric', { 'table-readable-cell': column.readable, 'table-wrap-cell': column.wrap, 'table-truncate-cell': column.truncate, 'table-account-cell': column.key === 'account' }]" :title="column.truncate ? column.value(record, index) : undefined">
              <span :class="column.tone?.(record)">{{ column.value(record, index) }}</span>
              <span v-if="column.second" class="table-cell-secondary" :class="[column.secondTone?.(record), { 'app-numeric': column.secondNumeric }]">{{ column.second(record) }}</span>
            </td>
            <td v-if="kind === 'orders'"><button type="button" class="table-history-button" :aria-label="`查看${record.name}订单历史 ${record.orderNo}`" @click.stop="$emit('action', { record, action: 'history', event: $event })"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>查看</button></td>
          </tr>
          <tr v-if="hasExpandableActions && expandedRecordId === record.id" :id="`${tableId}-${record.id}-actions`" class="table-actions-row" @keydown.esc.stop.prevent="collapseActions">
            <td :colspan="columns.length + 1 + (kind === 'orders' ? 1 : 0)">
              <div class="table-expanded-actions" role="group" :aria-label="actionLabel(record)">
                <div v-if="kind === 'orders'" class="table-order-buttons">
                  <button v-if="canConvertOrder(record)" type="button" :aria-label="`${record.name}转手工 ${record.orderNo}`" @click="$emit('action', { record, action: 'convert', event: $event })"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h12"/></svg>转手工</button>
                  <template v-else>
                    <button type="button" :disabled="!!orderActionReason(record)" :title="orderActionReason(record)" :aria-label="`${record.name}改单 ${record.orderNo}`" @click="$emit('action', { record, action: 'amend', event: $event })"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-1 5 5-1L20 8a2.8 2.8 0 0 0-4-4L4 16Zm10-10 4 4M4 16l4 4"/></svg>改单</button>
                    <button type="button" class="table-order-cancel" :disabled="!!orderActionReason(record, '撤单')" :title="orderActionReason(record, '撤单')" :aria-label="`${record.name}撤单 ${record.orderNo}`" @click="$emit('action', { record, action: 'cancel', event: $event })"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>撤单</button>
                  </template>
                </div>
                <div v-else-if="record.direction === '多'" class="record-actions">
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
.equity-table-scroll.is-order-scroll { scroll-padding-inline: 76px 0; }
.equity-data-table { table-layout: fixed; border-spacing: 0; border-collapse: separate; color: var(--app-color-text); font-size: 12px; text-align: right; }
th, td { padding: 4px; border-bottom: 1px solid var(--app-color-border); background: var(--app-color-card); font-size: inherit; vertical-align: middle; }
thead th { position: sticky; top: 0; z-index: 2; height: 44px; padding: 0 2px; line-height: 16px; background: var(--app-color-control); color: var(--app-color-text-secondary); font-weight: 400; }
tbody td { line-height: 18px; overflow-wrap: anywhere; }
.table-sort-button { display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: flex-end; gap: 2px; padding: 2px 0; border: 0; background: transparent; color: inherit; font: inherit; line-height: 16px; text-align: inherit; }
.table-sort-button > span { min-width: 0; overflow-wrap: anywhere; }
/* 对齐 Customer variants.css 最终 caret-wrapper / sort-caret：上下实心三角。 */
.table-sort-indicator { display: grid; grid-template-columns: 100%; grid-template-rows: 3px 3px; row-gap: 3px; place-content: center; width: 6px; height: 12px; flex: 0 0 6px; }
.table-sort-indicator > i { display: block; width: 100%; height: 100%; border: 0; border-radius: 1px; background: #7f8793; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.table-sort-indicator .descending { transform: rotate(180deg); }
.table-sort-indicator .is-active { background: var(--app-color-accent); }
thead th:not(.table-text-cell):not(.table-symbol) .table-sort-indicator { width: 7px; flex-basis: 7px; grid-template-rows: 4px 4px; }
.table-sort-button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-sort-button:active { color: var(--app-color-accent); }
tbody tr:last-child > * { border-bottom: 0; }
.table-symbol { position: sticky; left: 0; z-index: 1; padding: 0; border-right: 1px solid var(--app-color-frame); box-shadow: 4px 0 6px -5px #000; text-align: left; }
thead .table-symbol { z-index: 3; padding: 0 4px; }
thead .table-symbol .table-sort-button { justify-content: space-between; }
.table-header-secondary { display: block; margin-top: 2px; }
.table-detail-trigger { display: block; width: 100%; min-height: 44px; padding: 4px; border: 0; background: none; color: inherit; font-size: inherit; text-align: left; }
.table-detail-trigger:active { background: var(--app-color-control); }
.table-detail-trigger:focus-visible { outline-offset: -3px; }
.table-symbol-name { display: flex; align-items: center; justify-content: space-between; gap: 2px; font-size: inherit; font-weight: 600; line-height: 18px; }
.table-symbol-name svg { width: 12px; height: 12px; flex-shrink: 0; fill: none; stroke: var(--app-color-text-secondary); stroke-width: 1.2; }
.table-symbol-code { display: block; margin-top: 2px; color: var(--app-color-text-secondary); font-size: inherit; font-weight: 400; line-height: 16px; }
.table-cell-secondary { display: block; color: var(--app-color-text-secondary); font-size: inherit; }
.table-cell-secondary.equity-positive { color: var(--app-color-rise); }
.table-cell-secondary.equity-negative { color: var(--app-color-fall); }
.table-cell-secondary.equity-accent { color: var(--app-color-accent); }
.table-text-cell { text-align: left; }
.table-account-cell { white-space: nowrap; overflow-wrap: normal; }
.table-account-cell .table-sort-button { justify-content: flex-start; text-align: left; }
.table-account-cell > span, .table-account-cell .table-sort-button > span { display: inline-block; flex-shrink: 0; white-space: nowrap; overflow-wrap: normal; }
.table-readable-cell .record-status { display: inline-block; max-width: 100%; padding: 2px 5px; font-size: inherit; line-height: 18px; white-space: normal; overflow-wrap: anywhere; }
td.table-wrap-cell { white-space: normal; overflow-wrap: anywhere; }
td.table-truncate-cell > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
td .record-tag { font-size: inherit; }
:is(.is-positions, .is-orders) tbody tr:not(.table-actions-row) { cursor: pointer; }
:is(.is-positions, .is-orders) .is-expanded > * { background: var(--app-color-control); }
.table-detail-trigger[aria-expanded="true"] svg { transform: rotate(90deg); }
:is(.is-positions, .is-orders) .table-actions-row > td { padding: 0; background: var(--app-color-control); }
/* 展开栏跟随表格可视容器宽度，横向滚动时按钮仍留在当前行下方。 */
.table-expanded-actions { position: sticky; left: 0; display: flex; width: calc(100cqw - 2px); align-items: center; justify-content: center; gap: 8px; padding: 0 8px; }
.table-expanded-actions .record-action { display: flex; min-width: 160px; min-height: 44px; align-items: center; padding: 6px 0; border: 0; border-radius: 2px; background: none; font-size: inherit; font-weight: 500; }
.table-expanded-actions button > span { display: flex; width: 100%; min-height: 32px; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; border: 1px solid transparent; border-radius: 2px; }
.table-expanded-actions .record-action-close > span { background: color-mix(in srgb, var(--app-color-sell) 88%, #000); }
.table-expanded-actions svg { width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.table-expanded-actions button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.table-expanded-actions button:active { opacity: .7; }
.is-orders .table-expanded-actions { padding: 8px 12px; }
.table-order-buttons { display: flex; width: 100%; align-items: center; justify-content: center; gap: 8px; }
.table-order-buttons button { display: flex; min-width: 0; max-width: 160px; min-height: 36px; flex: 1; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 0; border-radius: 2px; background: var(--app-color-accent); color: #fff; font: inherit; font-size: 12px; white-space: nowrap; }
.table-order-buttons .table-order-cancel { background: var(--app-color-buy); color: #fff; }
.table-order-buttons button:disabled { color: var(--app-color-text-secondary); opacity: .45; cursor: not-allowed; }
.table-order-buttons button:enabled:active { filter: brightness(.88); }
.table-history-button:active { background: var(--app-color-accent-soft); }
.table-history-button { display: flex; width: 100%; min-height: 36px; align-items: center; justify-content: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--app-color-accent); font: inherit; }
.table-history-button svg { width: 12px; height: 12px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
</style>
