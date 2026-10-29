<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { showToast } from 'vant'
import EquityRecordsTable from './EquityRecordsTable.vue'
import EquityFilters from './EquityFilters.vue'
import { confirmationColumns, confirmationFilterFields, confirmationFiles, defaultConfirmationFilters } from '../../data/confirmationModel.js'
import { useConfirmationRecords } from '../../data/useConfirmationRecords.js'
import { prepareConfirmationDownload, saveConfirmationDownload } from '../../data/confirmationDownload.js'

defineProps({ design: { type: String, default: 'baseline' } })
const emit = defineEmits(['overlay-change'])
const { today, draft, refreshKey, page, pages, sort, error, rows, groups, pageGroups, query, reset, selected, allSelected, partiallySelected, toggleSelection, selectPage } = useConfirmationRecords()
const collapsed = ref(new Set()), filtersVisible = ref(false), moreFiltersVisible = ref(false), downloading = ref(false), panel = ref(null)
const popupContainer = computed(() => panel.value?.closest('.equity-page'))
const defaults = computed(() => defaultConfirmationFilters(today.value))
watch(filtersVisible, visible => emit('overlay-change', visible))
onBeforeUnmount(() => emit('overlay-change', false))
const tableRows = computed(() => pageGroups.value.flatMap(group => [group, ...(!collapsed.value.has(group.documentNo) ? group.children : [])]))
const columns = [{ key: 'selection', title: '', width: 48, text: true, value: () => '' }, ...confirmationColumns.map(column => ({ ...column, title: column.label, text: true, truncate: true, value: row => {
  if (column.key === 'documentNo') return row.isDocument ? `${row.documentNo} (${row.children.length})` : ''
  if (row.isDocument) return column.key === 'template' ? row.template : ''
  return column.key === 'template' ? '' : row[column.key] || '--'
} })), { key: 'download', title: '操作', width: 112, text: true, value: () => '' }]
const keys = columns.map(column => column.key)
function toggleDocument(documentNo) {
  const next = new Set(collapsed.value)
  if (next.has(documentNo)) next.delete(documentNo)
  else next.add(documentNo)
  collapsed.value = next
}
let returnFocus
function openFilters(event) { returnFocus = event.currentTarget; moreFiltersVisible.value = false; filtersVisible.value = true }
function restoreFocus() { nextTick(() => returnFocus?.focus()) }
function applyFilters(value) { Object.assign(draft.value, value.filters); query() }
function clearSearch() { draft.value.documentNo = ''; query() }
async function download(ids) {
  if (downloading.value) return
  downloading.value = true
  try { const archive = await prepareConfirmationDownload(ids, { baseUrl: import.meta.env.BASE_URL }); saveConfirmationDownload(archive); showToast(`已生成 ${archive.count} 份交易确认书`) }
  catch (error) { showToast(error.message || '下载失败，请重试') }
  finally { downloading.value = false }
}
</script>

<template>
  <div ref="panel" class="equity-tab-panel confirmation-records">
    <div class="equity-toolbar">
      <van-button class="confirmation-batch-download" size="small" :loading="downloading" :disabled="!selected.length || downloading" @click="download(selected)">生成交易确认书{{ selected.length ? ` (${selected.length})` : '' }}</van-button>
      <form class="equity-quick-search" @submit.prevent="query"><div class="equity-search-field" :class="{ 'has-query': draft.documentNo }"><svg class="equity-search-leading" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input v-model="draft.documentNo" aria-label="确认书文档编号筛选" placeholder="确认书文档编号" enterkeyhint="search" autocomplete="off"><div class="equity-search-actions"><button type="button" class="equity-search-action" aria-label="清空确认书搜索" @click="clearSearch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button><button type="submit" class="equity-search-action" aria-label="查询交易确认书"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button></div></div></form>
      <button type="button" class="equity-filter-trigger" aria-label="交易确认书筛选" @click="openFilters($event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg><span>筛选</span></button>
    </div>
    <p v-if="error" class="confirmation-context confirmation-error" role="alert">{{ error }}</p>
    <EquityRecordsTable v-if="tableRows.length" :key="refreshKey" kind="confirmations" :fixed-column-count="2" :records="tableRows" :design="design" readonly :column-keys="keys" :custom-columns="columns" :sort-state="sort" label-override="交易确认书" @sort-change="sort = $event">
      <template #header-selection><van-checkbox class="confirmation-selection" shape="square" :icon-size="16" :model-value="allSelected" :indeterminate="partiallySelected" :disabled="downloading" aria-label="选择本页全部确认书" @update:model-value="selectPage" /></template>
      <template #cell-selection="{ record }"><van-checkbox class="confirmation-selection" shape="square" :icon-size="16" v-if="record.isDocument" :model-value="selected.includes(record.documentNo)" :disabled="downloading" :aria-label="`选择确认书 ${record.documentNo}`" @update:model-value="toggleSelection(record.documentNo)" /></template>
      <template #cell-documentNo="{ record }"><button v-if="record.isDocument" type="button" class="confirmation-document" :aria-label="`${!collapsed.has(record.documentNo) ? '收起' : '展开'}${record.documentNo}`" :aria-expanded="!collapsed.has(record.documentNo)" @click="toggleDocument(record.documentNo)"><svg viewBox="0 0 16 16" aria-hidden="true" :class="{ expanded: !collapsed.has(record.documentNo) }"><path d="m6 3 5 5-5 5"/></svg><span>{{ record.documentNo }} ({{ record.children.length }})</span></button></template>
      <template #header-download>操作</template>
      <template #cell-download="{ record }"><button v-if="record.isDocument" type="button" class="table-history-button" :disabled="downloading" :aria-label="`生成交易确认书 ${record.documentNo}`" :title="confirmationFiles[record.documentNo]?.demo ? '生成演示确认书（ZIP）' : '生成交易确认书（ZIP）'" @click="download([record.documentNo])">生成交易确认书</button></template>
    </EquityRecordsTable>
    <div v-else class="equity-empty"><p>没有符合条件的交易确认书</p><van-button size="small" plain @click="reset">重置筛选</van-button></div>
    <p class="confirmation-context" role="status">共 {{ groups.length }} 份交易确认书 · {{ rows.length }} 条交易事件</p>
    <van-pagination v-if="pages > 1" v-model="page" :page-count="pages" mode="simple" prev-text="上一页" next-text="下一页" class="equity-pagination" />
    <EquityFilters v-model:show="filtersVisible" :teleport="popupContainer" title-override="交易确认书筛选" kind="confirmations" :filters="draft" :defaults="defaults" :selected-accounts="[]" @apply="applyFilters" @reset="reset" @closed="restoreFocus">
      <template #fields="{ filters }">
        <fieldset v-for="field in confirmationFilterFields" v-show="field.primary || moreFiltersVisible" :key="field.key" class="filter-group"><legend class="app-form-label">{{ field.label }}</legend>
          <div v-if="field.type === 'date'" class="confirmation-dates" :class="{ 'is-empty': !filters.range.some(Boolean) }"><span v-if="!filters.range.some(Boolean)" class="confirmation-date-placeholder">请选择日期</span><van-field class="equity-filter-input"><template #input><input v-model="filters.range[0]" type="date" :max="today" aria-label="事件开始日期" class="van-field__control"></template></van-field><van-field class="equity-filter-input"><template #input><input v-model="filters.range[1]" type="date" :max="today" aria-label="事件结束日期" class="van-field__control"></template></van-field></div>
          <div v-else-if="field.options" class="filter-options filter-options--segmented"><button v-for="option in ['', ...field.options]" :key="option" type="button" class="filter-chip" :aria-pressed="filters[field.key] === option" @click="filters[field.key] = option">{{ option || '全部' }}</button></div>
          <van-field v-else v-model="filters[field.key]" :placeholder="`请输入${field.label}`" :aria-label="`${field.label}筛选`" class="equity-filter-input" clearable />
        </fieldset>
        <button type="button" class="filter-chip confirmation-more-filters" :aria-expanded="moreFiltersVisible" @click="moreFiltersVisible = !moreFiltersVisible">{{ moreFiltersVisible ? '收起更多筛选条件' : '更多筛选条件' }}</button>
      </template>
    </EquityFilters>
  </div>
</template>

<style scoped>
.confirmation-records :deep(.equity-data-table) { table-layout: fixed; }
.confirmation-batch-download { width: 144px; height: auto; align-self: stretch; flex: none; margin-right: 18px; }
.confirmation-selection { padding-left: 8px; }
.confirmation-document { display: flex; min-height: 44px; align-items: center; gap: 4px; border: 0; padding: 0; background: transparent; color: inherit; font: inherit; white-space: nowrap; }
.confirmation-document svg { width: 12px; height: 12px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.5; }
.confirmation-document svg.expanded { transform: rotate(90deg); }
.confirmation-document:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.confirmation-context { flex: none; margin: 0; padding: 8px 12px; color: var(--app-color-text-secondary); font-size: 11px; }
.confirmation-error { color: var(--app-color-rise); }
.confirmation-dates { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.confirmation-dates input { min-width: 0; color-scheme: dark; }
.confirmation-date-placeholder { position: absolute; z-index: 1; top: 50%; left: 12px; transform: translateY(-50%); pointer-events: none; color: var(--app-color-text-secondary); font-size: 14px; }
.confirmation-dates.is-empty input::-webkit-datetime-edit { color: transparent; }
.confirmation-more-filters { width: 100%; }
</style>
