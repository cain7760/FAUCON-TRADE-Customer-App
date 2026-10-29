<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import EquityFilters from './EquityFilters.vue'
import EquityRecordsTable from './EquityRecordsTable.vue'
import EquityConfirmationRecords from './EquityConfirmationRecords.vue'
import { recordTableColumns } from './recordTableColumns.js'
import { accounts } from './fixtures.js'
import { historyCell, historyTabs as recordTabs } from '../../data/historyModel.js'
import { useHistoryRecords } from '../../data/useHistoryRecords.js'

const props = defineProps({ design: { type: String, default: 'baseline' }, readHistorySource: { type: Function, default: () => ({ orders: [], trades: [] }) } })
const emit = defineEmits(['overlay-change'])
const { kind: historyKind, state, draft, rows, pageRows, maxDate, pages, query, reset, sortBy, accountIds } = useHistoryRecords({ readSource: () => props.readHistorySource(), accounts })
const historyTabs = [...recordTabs, { key: 'confirmations', label: '交易确认书' }]
const kind = ref('orders')
watch(kind, value => { if (value !== 'confirmations') historyKind.value = value })
const filtersVisible = ref(false), confirmationOverlay = ref(false)
const overlayOpen = computed(() => filtersVisible.value || confirmationOverlay.value)
watch(overlayOpen, value => emit('overlay-change', value))
const selectedAccounts = computed(() => accountIds.value.length ? accountIds.value : accounts.map(account => account.id))
const label = computed(() => historyTabs.find(tab => tab.key === kind.value).label)
const tableColumns = computed(() => {
  const fields = recordTableColumns(kind.value, props.design).map(column => kind.value === 'trades' && column.key === 'filledPrice' ? { ...column, title: '成交价格', value: row => historyCell(row, 'filledPrice') } : column)
  return [{ key: 'orderDate', title: '委托日期', width: 100, text: true, value: row => row.orderDate }, ...fields]
})
let returnFocus
function openFilters(event) { returnFocus = event.currentTarget; filtersVisible.value = true }
function restoreFocus() { nextTick(() => returnFocus?.focus()) }
function applyFilters(value) {
  Object.assign(draft.value, value.filters)
  accountIds.value = value.accounts.length === accounts.length ? [] : [...value.accounts]
  query()
}
function apply() { query() }
function clearSearch() { draft.value.symbol = ''; query() }
function sortChange(value) { sortBy(value.key, value.direction === 'none' ? null : value.direction) }
</script>

<template>
  <section class="equity-page history-data-page" :class="{ 'history-data-page--overlay-nav': design === 'baseline' }" aria-label="历史交易记录">
    <div class="equity-workspace" :inert="overlayOpen ? true : undefined">
      <header class="equity-page-header"><div class="equity-page-title"><h1>数据</h1></div></header>
      <van-tabs v-model:active="kind" class="equity-list-tabs" :ellipsis="false" :duration="0">
        <van-tab v-for="tab in historyTabs" :key="tab.key" :name="tab.key"><template #title><span class="equity-tab-title">{{ tab.label }}</span></template>
          <EquityConfirmationRecords v-if="kind === tab.key && kind === 'confirmations'" :design="design" @overlay-change="confirmationOverlay = $event" />
          <div v-else-if="kind === tab.key" class="equity-tab-panel">
            <div class="equity-toolbar">
              <form class="equity-quick-search" @submit.prevent="apply"><div class="equity-search-field" :class="{ 'has-query': draft.symbol || state.applied.symbol }"><svg class="equity-search-leading" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input v-model="draft.symbol" :aria-label="`${label}标的搜索`" placeholder="标的名称 / 代码" enterkeyhint="search" autocomplete="off"><div class="equity-search-actions" role="group" :aria-label="`${label}搜索操作`"><button type="button" class="equity-search-action" :aria-label="`清空${label}搜索`" @click="clearSearch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button><button type="submit" class="equity-search-action" :aria-label="`搜索${label}`"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button></div></div></form>
              <button type="button" class="equity-filter-trigger" :aria-label="`${label}筛选`" @click="openFilters($event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg><span>筛选</span></button>
            </div>
            <p v-if="state.error" class="filter-error history-data-message" role="alert">{{ state.error }}</p>
            <p class="history-data-context" role="status">{{ state.applied.range[0] }} 至 {{ state.applied.range[1] }} · 共 {{ rows.length }} 条</p>
            <EquityRecordsTable v-if="pageRows.length" :kind="kind" :records="pageRows" :design="design" readonly :custom-columns="tableColumns" :sort-state="state.sort" :label-override="label" @sort-change="sortChange" />
            <div v-else class="equity-empty"><p>没有符合条件的历史记录</p><van-button size="small" plain @click="reset">重置筛选</van-button></div>
            <footer v-if="pages > 1" class="history-data-pagination"><van-pagination v-model="state.page" :page-count="pages" mode="simple" prev-text="上一页" next-text="下一页" class="equity-pagination" aria-label="历史记录分页" /></footer>
          </div>
        </van-tab>
      </van-tabs>
    </div>
    <EquityFilters v-if="kind !== 'confirmations'" v-model:show="filtersVisible" include-accounts :kind="kind" :filters="draft" :selected-accounts="selectedAccounts" account-scope-label="对当前历史表生效" @apply="applyFilters" @reset="reset" @closed="restoreFocus">
      <template #after-order-number="{ filters }">
        <fieldset class="filter-group"><legend class="app-form-label">{{ kind === 'orders' ? '委托日期' : '成交日期' }}</legend>
          <div class="history-data-dates">
            <label><span class="app-form-label">开始日期</span><van-field class="equity-filter-input"><template #input><input v-model="filters.range[0]" class="van-field__control" type="date" :max="maxDate" aria-label="历史开始日期" required></template></van-field></label>
            <label><span class="app-form-label">结束日期</span><van-field class="equity-filter-input"><template #input><input v-model="filters.range[1]" class="van-field__control" type="date" :max="maxDate" aria-label="历史结束日期" required></template></van-field></label>
          </div>
          <div class="status-selection"><button type="button" :disabled="filters.range.every(value => !value)" @click="filters.range = ['', '']">清除日期</button></div>
        </fieldset>
      </template>
    </EquityFilters>
  </section>
</template>

<style scoped>
/* 仅扩展历史日期与分页布局，筛选/表格/状态/排序复用权益组件及其样式。 */
.history-data-page { min-height: 0; height: 100%; }
.history-data-page > .equity-workspace > .equity-page-header,
.history-data-page > .equity-workspace > .equity-list-tabs > :deep(.van-tabs__wrap) { background: transparent; }
.history-data-page--overlay-nav { padding-bottom: var(--mobile-bottom-nav-height); }
.history-data-dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); flex: none; gap: 8px; margin: 8px 0 0; }
.history-data-dates label { min-width: 0; }.history-data-dates .app-form-label { font-size: 11px; }
.history-data-dates input { min-width: 0; width: 100%; color-scheme: dark; font-family: var(--app-font-family-numeric); font-size: 12px; }
.history-data-context, .history-data-message { flex: none; margin: 0; padding: 4px 12px 8px; font-size: 11px; color: var(--app-color-text-secondary); }
.history-data-message { color: var(--app-color-rise); }
.history-data-pagination { flex: none; padding: 8px 12px; }
</style>
