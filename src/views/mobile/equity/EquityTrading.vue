<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { DocumentAdd, Refresh, Suitcase, Tickets } from '@element-plus/icons-vue'
import { accounts, demoRecords, focusPositions } from './fixtures.js'
import { advancedFilterCount, defaultFilters, filterCount, filterRecords, listTabs } from './model.js'
import EquityRecordCard from './EquityRecordCard.vue'
import EquityRecordsTable from './EquityRecordsTable.vue'
import EquityFilters from './EquityFilters.vue'
import EquityDetail from './EquityDetail.vue'
import EquityAccountSummary from './EquityAccountSummary.vue'
import EquityAccountTrigger from './EquityAccountTrigger.vue'
import { orderAccountOverview } from './accountOverview.js'
import EquityOrderEntry from './EquityOrderEntry.vue'
import EquityOrderOperation from './EquityOrderOperation.vue'
import EquityFocusRecords from './EquityFocusRecords.vue'
import EquityFocusDetail from './EquityFocusDetail.vue'
import EquityFocusTools from './EquityFocusTools.vue'
import EquityFocusHistory from './EquityFocusHistory.vue'
import EquityConceptCPosition from './EquityConceptCPosition.vue'
import { conceptCPositionColumnWidths } from './conceptCPosition.js'
import { focusDefaultColumnKeys } from './focusTableColumns.js'
import { applyDemoOrderAction, canConvertOrder, orderActionReason } from './orderActions.js'
import { demoAvailableCash, demoLedgerError, demoPositionRows, demoTradeRows, loadDemoOrders, saveDemoOrders, submitDemoOrder } from './demoLedger.js'
import ExceptionState from '../../../components/ExceptionState.vue'
import { useOrderSessionExpiry } from '../../../composables/useOrderSessionExpiry.js'
import './equity.css'

const props = defineProps({ orderLayout: { type: String, default: 'split' }, orderReview: Boolean, design: { type: String, default: 'baseline' }, appReview: Boolean })
const isFocusDesign = computed(() => props.design === 'focus')
const isConceptC = computed(() => props.design === 'c')
const usesPcRules = computed(() => isFocusDesign.value || isConceptC.value)
const emit = defineEmits(['overlay-change', 'home-change'])
const activeList = ref('positions')
const displayMode = ref('table')
const focusDisplayMode = ref('list')
const focusColumns = reactive(Object.fromEntries(listTabs.map(tab => [tab.key, focusDefaultColumnKeys(tab.key)])))
const focusRecordOrder = reactive({ list: {}, table: {} })
const refreshKeys = reactive({ positions: 0, orders: 0, trades: 0 })
const systemRunning = ref(true)
const toolsVisible = ref(false)
const historyVisible = ref(false), historyContext = ref(null)
const selectedAccounts = ref(['TZS_T0'])
const applied = reactive(Object.fromEntries(listTabs.map(tab => [tab.key, defaultFilters()])))
const searchDrafts = reactive({ positions: '', orders: '', trades: '' })
const filterVisible = ref(false)
const isActionVisible = ref(props.orderReview)
const orderEntryContext = ref(props.orderReview ? { action: 'new' } : null)
let demoStorage
try { demoStorage = globalThis.localStorage } catch { /* 禁用存储时保留本次页面状态。 */ }
const demoOrders = ref(loadDemoOrders(demoStorage))
const syncOrderClose = useOrderSessionExpiry(demoOrders)
watch(demoOrders, rows => saveDemoOrders(demoStorage, rows), { deep: true, immediate: true })
function readHistorySource() { syncOrderClose(); return { orders: demoOrders.value, trades: demoTradeRows(demoOrders.value) } }
function openMessageOrder(id, event) {
  const index = demoOrders.value.findIndex(row => row.id === id)
  if (index < 0) return false
  activeList.value = 'orders'
  openDetail('orders', demoOrders.value[index], index, event)
  return true
}
defineExpose({ readHistorySource, readMessageSource: () => demoOrders.value, openMessageOrder })
const positionRows = computed(() => demoPositionRows(demoOrders.value, usesPcRules.value ? focusPositions : demoRecords.positions))
const orderCash = computed(() => Object.fromEntries(accounts.map(account => [account.id, demoAvailableCash(demoOrders.value, account.id)])))
const portfolioOverview = computed(() => orderAccountOverview(selectedAccounts.value, positionRows.value, orderCash.value))
const operationVisible = ref(false), operationContext = ref(null), operationResult = ref(''), operationError = ref('')
const selectedRecord = ref(null)
watch(() => !selectedRecord.value, value => emit('home-change', value), { immediate: true, flush: 'sync' })
const positionDetailVisible = ref(false), positionDetail = ref(null), pendingPositionAction = ref(null)
const isPositionDetail = computed(() => selectedRecord.value?.kind === 'positions')
const isOverlayOpen = computed(() => filterVisible.value || isActionVisible.value || operationVisible.value || isPositionDetail.value || historyVisible.value || (isFocusDesign.value && (!!selectedRecord.value || toolsVisible.value)))
watch(isOverlayOpen, value => emit('overlay-change', value), { immediate: true })
const accountOnly = ref(false)
const records = computed(() => Object.fromEntries(listTabs.map(tab => [tab.key, filterRecords(tab.key, tab.key === 'orders' ? demoOrders.value : tab.key === 'positions' ? positionRows.value : demoTradeRows(demoOrders.value), applied[tab.key], selectedAccounts.value)])))
// 只保存展示顺序；导出内容始终取当前筛选记录，避免筛选为空后沿用旧数据。
const focusExportRecords = computed(() => Object.fromEntries(listTabs.map(({ key }) => {
  const rows = records.value[key]
  const ids = focusRecordOrder[focusDisplayMode.value][key] || []
  const ranks = new Map(ids.map((id, index) => [id, index]))
  return [key, [...rows].sort((left, right) => (ranks.get(left.id) ?? ids.length) - (ranks.get(right.id) ?? ids.length))]
})))
function updateFocusRecordOrder(kind, view, ids) { if (isFocusDesign.value) focusRecordOrder[view][kind] = ids }
const accountSummary = computed(() => selectedAccounts.value.length === accounts.length ? '全部账户' : selectedAccounts.value.length > 1 ? `${selectedAccounts.value.length}个账户` : accounts.find(account => account.id === selectedAccounts.value[0])?.name)
let returnFocus = null
let historyReturnFocus = null
function refreshRecords(kind) { refreshKeys[kind] += 1 }
function restoreHistoryFocus() { nextTick(() => historyReturnFocus?.isConnected ? historyReturnFocus.focus() : restoreFocus()) }
function openFilters(onlyAccounts, event) { returnFocus = event.currentTarget; accountOnly.value = onlyAccounts; filterVisible.value = true }
function applyFilters(value) {
  if (accountOnly.value) selectedAccounts.value = value.accounts
  if (!accountOnly.value) { applied[activeList.value] = value.filters; searchDrafts[activeList.value] = value.filters.symbol }
}
function resetFilters() { applied[activeList.value] = defaultFilters(); searchDrafts[activeList.value] = '' }
function search(kind) { applied[kind] = { ...applied[kind], symbol: searchDrafts[kind] } }
function clearSearch(kind, event) {
  searchDrafts[kind] = ''
  applied[kind] = { ...applied[kind], symbol: '' }
  event.currentTarget.closest('form')?.querySelector('input')?.focus()
}
function openDetail(kind, row, index, event) {
  returnFocus = event.currentTarget.tagName === 'TR' ? event.currentTarget.querySelector('button') : event.currentTarget
  selectedRecord.value = { kind, row, index }
  if (isFocusDesign.value) nextTick(() => document.querySelector('.focus-detail .detail-header button')?.focus())
  else if (kind === 'positions') positionDetailVisible.value = true
  else nextTick(() => document.querySelector('.detail-header button')?.focus())
}
function restoreFocus() { nextTick(() => (returnFocus?.isConnected && !returnFocus.disabled ? returnFocus : document.querySelector('.equity-order-entry'))?.focus()) }
function closeDetail() {
  const action = pendingPositionAction.value
  pendingPositionAction.value = null
  selectedRecord.value = null
  if (action) openPositionAction(action.record, { action: action.action })
  else restoreFocus()
}
function openDetailAction({ action }) {
  pendingPositionAction.value = { record: selectedRecord.value.row, action }
  positionDetailVisible.value = false
}
function openFocusAction({ action, event }) {
  const { kind, row } = selectedRecord.value
  if (action === 'history') { historyReturnFocus = event.currentTarget; historyContext.value = { kind, record: row }; historyVisible.value = true; return }
  if (!systemRunning.value) return
  const listFocus = returnFocus
  selectedRecord.value = null
  if (kind === 'positions' && action === 'new') { orderEntryContext.value = { action: 'new', record: row }; isActionVisible.value = true }
  else if (kind === 'positions') openPositionAction(row, { action })
  else openTableAction(kind, { record: row, action, event })
  returnFocus = listFocus
}
function openOrderEntry(event) {
  returnFocus = event.currentTarget
  orderEntryContext.value = { action: 'new' }
  isActionVisible.value = true
}
function openPositionAction(record, { action, event }) {
  if (record.direction !== '多' || !['chase', 'close'].includes(action)) return
  if (event) returnFocus = event.currentTarget
  orderEntryContext.value = { record, action }
  isActionVisible.value = true
}
function openTableAction(kind, { record, action, event }) {
  if (action === 'history') { historyReturnFocus = event.currentTarget; historyContext.value = { kind, record }; historyVisible.value = true; return }
  if (isFocusDesign.value && !systemRunning.value) return
  if (kind !== 'orders') { openPositionAction(record, { action, event }); return }
  if (['amend', 'cancel'].includes(action) && orderActionReason(record)) return
  if (action === 'convert' && !canConvertOrder(record)) return
  returnFocus = event.currentTarget
  if (action === 'amend') {
    orderEntryContext.value = { record, action }
    isActionVisible.value = true
  } else {
    operationContext.value = { record, action }
    operationResult.value = ''; operationError.value = ''; operationVisible.value = true
  }
}
function confirmOperation(payload) {
  if (isFocusDesign.value && !systemRunning.value) { operationError.value = '系统已中断，暂不可执行交易操作'; return }
  try {
    operationResult.value = applyOrderAction(operationContext.value.record.id, operationContext.value.action, payload)
  } catch (error) { operationError.value = error.message }
}
function applyOrderAction(id, action, payload) {
  const nextOrders = JSON.parse(JSON.stringify(demoOrders.value))
  const message = applyDemoOrderAction(nextOrders, id, action, payload, new Date(), { pcParity: usesPcRules.value })
  const error = demoLedgerError(nextOrders)
  if (error) throw new Error(error)
  const currentById = new Map(demoOrders.value.map(row => [row.id, row]))
  demoOrders.value = nextOrders.map(row => currentById.has(row.id) ? Object.assign(currentById.get(row.id), row) : row)
  return message
}
function confirmAmendment(payload, respond) {
  if (isFocusDesign.value && !systemRunning.value) { respond({ error: '系统已中断，暂不可执行交易操作' }); return }
  try { respond({ message: applyOrderAction(payload.orderId, 'amend', payload) }) }
  catch (error) { respond({ error: error.message }) }
}
function confirmOrder(snapshot, respond) {
  if (isFocusDesign.value && !systemRunning.value) { respond({ error: '系统已中断，暂不可执行交易操作' }); return }
  try {
    submitDemoOrder(demoOrders.value, snapshot)
    // 新委托不能被提交前的其他账户、证券搜索或状态条件隐藏。
    if (!selectedAccounts.value.includes(snapshot.account)) selectedAccounts.value = [snapshot.account]
    applied.orders = defaultFilters(); searchDrafts.orders = ''
    activeList.value = 'orders'
    const saved = saveDemoOrders(demoStorage, demoOrders.value)
    respond({ message: `订单已加入所有订单，状态为待报。${saved ? '' : '浏览器存储不可用，刷新后不会保留。'}` })
  } catch (error) { respond({ error: error.message }) }
}
</script>

<template>
  <section class="equity-page" aria-label="权益交易">
    <div v-show="!selectedRecord || isPositionDetail || isFocusDesign" class="equity-workspace" :inert="isOverlayOpen || selectedRecord ? true : undefined">
      <header class="equity-page-header">
        <div class="equity-page-title"><h1>权益交易</h1></div>
        <EquityAccountTrigger :label="accountSummary" :compact="!isFocusDesign" aria-label="选择下单账户" @click="openFilters(true, $event)" />
      </header>
      <EquityAccountSummary v-if="design === 'baseline'" class="equity-portfolio-summary" :summary="portfolioOverview" visible compact />
      <van-tabs v-model:active="activeList" class="equity-list-tabs" :ellipsis="false" :swipe-threshold="3" :duration="0">
        <van-tab v-for="list in listTabs" :key="list.key" :name="list.key" :title="`${list.label}（${records[list.key].length}）`">
          <template #title><span class="equity-tab-title"><component v-if="design === 'baseline'" :is="list.key === 'positions' ? Suitcase : list.key === 'orders' ? Tickets : Refresh" class="equity-tab-icon" aria-hidden="true" /><span>{{ design === 'baseline' ? list.label.replace('所有', '') : list.label }}</span><span class="equity-tab-total app-numeric" :class="{ 'equity-tab-total--baseline': !isFocusDesign }">{{ records[list.key].length }}</span></span></template>
          <div class="equity-tab-panel" :class="{ 'is-trades': list.key === 'trades' }">
            <div class="equity-toolbar">
              <form class="equity-quick-search" @submit.prevent="search(list.key)">
                <div class="equity-search-field" :class="{ 'has-query': searchDrafts[list.key] || applied[list.key].symbol }">
                  <svg class="equity-search-leading" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
                  <input v-model="searchDrafts[list.key]" :aria-label="`${list.label}标的搜索`" :placeholder="list.key === 'positions' ? '代码 / 名称' : '标的名称 / 代码'" enterkeyhint="search" autocomplete="off">
                  <div class="equity-search-actions" role="group" :aria-label="`${list.label}搜索操作`">
                    <button type="button" class="equity-search-action" :aria-label="`清空${list.label}搜索`" @click="clearSearch(list.key, $event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
                    <button type="submit" class="equity-search-action" :aria-label="`搜索${list.label}`"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button>
                  </div>
                </div>
              </form>
              <button type="button" class="equity-filter-trigger" :class="{ 'is-filtered': advancedFilterCount(list.key, applied[list.key]) }" :aria-label="`${list.label}筛选`" @click="openFilters(false, $event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg><span>筛选</span><i v-if="advancedFilterCount(list.key, applied[list.key])">{{ advancedFilterCount(list.key, applied[list.key]) }}</i></button>
              <div v-if="design === 'baseline' && list.key !== 'trades'" class="equity-view-switch equity-view-switch--inline" role="group" aria-label="列表展示方式">
                <button type="button" aria-label="表格视图" title="表格视图" :aria-pressed="displayMode === 'table'" @click="displayMode = 'table'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11M8 14h13"/></svg></button>
                <button type="button" aria-label="卡片视图" title="卡片视图" :aria-pressed="displayMode === 'cards'" @click="displayMode = 'cards'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2" width="18" height="8" rx="2"/><rect x="3" y="14" width="18" height="8" rx="2"/><path d="M7 6h4M7 18h4"/></svg></button>
              </div>
              <EquityFocusTools v-if="isFocusDesign" v-model="focusColumns[list.key]" :kind="list.key" :records="focusExportRecords[list.key]" @refresh="refreshRecords(list.key)" @columns-saved="focusDisplayMode = 'table'" @overlay-change="toolsVisible = $event" />
            </div>
            <div v-if="isFocusDesign && (focusDisplayMode === 'table' || !records[list.key].length)" class="focus-view-toolbar">
              <span>{{ records[list.key].length }} 条记录</span>
              <div class="focus-view-switch" role="group" aria-label="列表展示方式"><button type="button" :aria-pressed="focusDisplayMode === 'list'" @click="focusDisplayMode = 'list'">卡片</button><button type="button" :aria-pressed="focusDisplayMode === 'table'" @click="focusDisplayMode = 'table'">表格</button></div>
            </div>
            <div v-else-if="!isFocusDesign && design !== 'baseline' && list.key !== 'trades'" class="equity-view-toolbar">
              <div class="equity-view-switch" role="group" aria-label="列表展示方式">
                <button type="button" :aria-pressed="displayMode === 'table'" @click="displayMode = 'table'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 9v12"/></svg><span>{{ isConceptC ? '表格' : '表格视图' }}</span></button>
                <button type="button" :aria-pressed="displayMode === 'cards'" @click="displayMode = 'cards'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="18" height="7" rx="1"/></svg><span>{{ isConceptC ? '卡片' : '卡片视图' }}</span></button>
              </div>
            </div>
            <EquityFocusRecords v-if="isFocusDesign && focusDisplayMode === 'list' && records[list.key].length" :key="`${list.key}-${refreshKeys[list.key]}`" :kind="list.key" :records="records[list.key]" @order-change="updateFocusRecordOrder(list.key, 'list', $event)" @open="({ record, index, event }) => openDetail(list.key, record, index, event)">
              <template #controls><div class="focus-view-switch" role="group" aria-label="列表展示方式"><button type="button" aria-pressed="true" @click="focusDisplayMode = 'list'">卡片</button><button type="button" aria-pressed="false" @click="focusDisplayMode = 'table'">表格</button></div></template>
            </EquityFocusRecords>
            <EquityRecordsTable v-else-if="(isFocusDesign ? focusDisplayMode === 'table' : list.key === 'trades' || displayMode === 'table') && records[list.key].length" :key="`${list.key}-${refreshKeys[list.key]}`" :kind="list.key" :records="records[list.key]" :design="design" :column-keys="isFocusDesign ? focusColumns[list.key] : null" :column-widths="isConceptC && list.key === 'positions' ? conceptCPositionColumnWidths : null" :selected-record-id="isConceptC ? selectedRecord?.row.id : null" :detail-on-click="isFocusDesign || (isConceptC && list.key === 'positions')" :system-running="!isFocusDesign || systemRunning" @order-change="updateFocusRecordOrder(list.key, 'table', $event)" @open="({ record, index, event }) => openDetail(list.key, record, index, event)" @action="payload => openTableAction(list.key, payload)" />
            <div v-else class="equity-records" :aria-label="`${list.label}列表`" tabindex="0">
              <template v-for="(record, index) in records[list.key]" :key="record.id">
                <EquityConceptCPosition v-if="isConceptC && list.key === 'positions'" :record="record" :index="index + 1" @open="openDetail(list.key, record, index + 1, $event)" @action="openPositionAction(record, $event)" />
                <EquityRecordCard v-else :kind="list.key" :record="record" @open="openDetail(list.key, record, index + 1, $event)" @action="openPositionAction(record, $event)" />
              </template>
              <div v-if="!records[list.key].length" class="equity-empty"><ExceptionState type="empty" :description="list.empty" compact :show-action="false" /><van-button v-if="filterCount(list.key, applied[list.key])" size="small" plain @click="resetFilters">重置筛选</van-button></div>
            </div>
          </div>
        </van-tab>
      </van-tabs>
      <div v-if="isFocusDesign" class="focus-trade-rail"><button type="button" class="focus-system-control" :aria-pressed="systemRunning" :aria-label="systemRunning ? '系统运行中，切换为中断' : '系统已中断，恢复运行'" @click="systemRunning = !systemRunning"><b>{{ systemRunning ? '运行中' : '系统已中断' }}</b></button><button type="button" class="equity-order-entry" aria-label="下单" aria-haspopup="dialog" @click="openOrderEntry"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M12 4v16"/></svg><span>下单</span></button></div>
      <div v-else-if="isConceptC" class="concept-c-trade-rail"><button type="button" class="equity-order-entry" aria-label="下单" aria-haspopup="dialog" @click="openOrderEntry"><DocumentAdd aria-hidden="true" />下单</button></div>
      <button v-else-if="design === 'baseline'" v-show="!isOverlayOpen" type="button" class="equity-order-entry" aria-label="下单" aria-haspopup="dialog" @click="openOrderEntry"><DocumentAdd aria-hidden="true" /><span>下单</span></button>
    </div>
    <EquityFocusDetail v-if="selectedRecord && isFocusDesign" :kind="selectedRecord.kind" :record="selectedRecord.row" :index="selectedRecord.index" :system-running="systemRunning" :inert="historyVisible ? true : undefined" @back="closeDetail" @action="openFocusAction" />
    <EquityDetail v-else-if="selectedRecord && !isPositionDetail" :kind="selectedRecord.kind" :record="selectedRecord.row" :index="selectedRecord.index" @back="closeDetail" />
    <van-popup v-if="isPositionDetail && !isFocusDesign" v-model:show="positionDetailVisible" position="bottom" round transition-appear class="equity-filter-sheet equity-position-sheet" :class="{ 'concept-c-position-sheet': isConceptC }" :overlay-class="isConceptC ? 'equity-sheet-overlay concept-c-position-overlay' : 'equity-sheet-overlay'" :duration=".2" aria-label="持仓详情" @opened="positionDetail?.focusClose()" @closed="closeDetail">
      <div class="sheet-handle" aria-hidden="true"></div>
      <EquityConceptCPosition v-if="isConceptC" ref="positionDetail" :record="selectedRecord.row" :index="selectedRecord.index" drawer @back="positionDetailVisible = false" @action="openDetailAction" />
      <EquityDetail v-else ref="positionDetail" kind="positions" :record="selectedRecord.row" :index="selectedRecord.index" drawer @back="positionDetailVisible = false" @action="openDetailAction" />
    </van-popup>
    <EquityFilters v-model:show="filterVisible" :account-only="accountOnly" :kind="activeList" :filters="{ ...applied[activeList], symbol: searchDrafts[activeList] }" :selected-accounts="selectedAccounts" @apply="applyFilters" @reset="resetFilters" @closed="restoreFocus" />
    <EquityFocusHistory v-if="historyContext" v-model:show="historyVisible" :kind="historyContext.kind" :record="historyContext.record" @closed="restoreHistoryFocus" />
    <EquityOrderEntry v-if="orderEntryContext" v-model:show="isActionVisible" :context="orderEntryContext" :layout="orderLayout" :design="design" :full-capabilities="usesPcRules" :overview-account-ids="selectedAccounts" :positions="positionRows" :account-cash="orderCash" :system-running="!isFocusDesign || systemRunning" @amend="confirmAmendment" @order="confirmOrder" @closed="restoreFocus" />
    <EquityOrderOperation v-if="operationContext" v-model:show="operationVisible" :context="operationContext" :result="operationResult" :error="operationError" @confirm="confirmOperation" @closed="restoreFocus" />
  </section>
</template>
