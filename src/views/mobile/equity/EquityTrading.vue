<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { accounts, demoRecords } from './fixtures.js'
import { advancedFilterCount, defaultFilters, filterCount, filterRecords, listTabs } from './model.js'
import EquityRecordCard from './EquityRecordCard.vue'
import EquityRecordsTable from './EquityRecordsTable.vue'
import EquityFilters from './EquityFilters.vue'
import EquityDetail from './EquityDetail.vue'
import EquityOrderEntry from './EquityOrderEntry.vue'
import ExceptionState from '../../../components/ExceptionState.vue'
import './equity.css'

const emit = defineEmits(['overlay-change'])
const activeList = ref('positions')
const displayMode = ref('cards')
const selectedAccounts = ref(['TZS_T0'])
const applied = reactive(Object.fromEntries(listTabs.map(tab => [tab.key, defaultFilters()])))
const searchDrafts = reactive({ positions: '', orders: '', trades: '' })
const filterVisible = ref(false)
const isActionVisible = ref(false)
const orderEntryContext = ref(null)
const isOverlayOpen = computed(() => filterVisible.value || isActionVisible.value)
watch(isOverlayOpen, value => emit('overlay-change', value))
const accountOnly = ref(false)
const selectedRecord = ref(null)
const records = computed(() => Object.fromEntries(listTabs.map(tab => [tab.key, filterRecords(tab.key, demoRecords[tab.key], applied[tab.key], selectedAccounts.value)])))
const accountSummary = computed(() => selectedAccounts.value.length === accounts.length ? '全部账户' : accounts.find(account => account.id === selectedAccounts.value[0])?.name)
let returnFocus = null
function openFilters(onlyAccounts, event) { returnFocus = event.currentTarget; accountOnly.value = onlyAccounts; filterVisible.value = true }
function applyFilters(value) {
  selectedAccounts.value = value.accounts
  if (!accountOnly.value) { applied[activeList.value] = value.filters; searchDrafts[activeList.value] = value.filters.symbol }
}
function resetFilters() { applied[activeList.value] = defaultFilters(); searchDrafts[activeList.value] = '' }
function search(kind) { applied[kind] = { ...applied[kind], symbol: searchDrafts[kind] } }
function openDetail(kind, row, index, event) { returnFocus = event.currentTarget; selectedRecord.value = { kind, row, index }; nextTick(() => document.querySelector('.detail-header button')?.focus()) }
function restoreFocus() { nextTick(() => returnFocus?.focus()) }
function closeDetail() { selectedRecord.value = null; restoreFocus() }
function openOrderEntry(event) {
  returnFocus = event.currentTarget
  orderEntryContext.value = { action: 'new' }
  isActionVisible.value = true
}
function openPositionAction(record, { action, event }) {
  if (record.direction !== '多' || !['chase', 'close'].includes(action)) return
  returnFocus = event.currentTarget
  orderEntryContext.value = { record, action }
  isActionVisible.value = true
}
</script>

<template>
  <section class="equity-page" aria-label="权益交易">
    <div v-show="!selectedRecord" class="equity-workspace" :inert="isOverlayOpen || selectedRecord ? true : undefined">
      <header class="equity-page-header">
        <h1>权益交易</h1>
        <button type="button" class="equity-account" aria-label="选择下单账户" @click="openFilters(true, $event)">
          <svg class="equity-account-icon" width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1.66667 16.6667C1.20833 16.6667 0.815972 16.5035 0.489583 16.1771C0.163194 15.8507 0 15.4583 0 15V5.83333C0 5.375 0.163194 4.98264 0.489583 4.65625C0.815972 4.32986 1.20833 4.16667 1.66667 4.16667H5.83333V1.66667C5.83333 1.20833 5.99653 0.815972 6.32292 0.489583C6.64931 0.163194 7.04167 0 7.5 0H9.16667C9.625 0 10.0174 0.163194 10.3438 0.489583C10.6701 0.815972 10.8333 1.20833 10.8333 1.66667V4.16667H15C15.4583 4.16667 15.8507 4.32986 16.1771 4.65625C16.5035 4.98264 16.6667 5.375 16.6667 5.83333V15C16.6667 15.4583 16.5035 15.8507 16.1771 16.1771C15.8507 16.5035 15.4583 16.6667 15 16.6667H1.66667V16.6667M1.66667 15H15V15V15V5.83333V5.83333V5.83333H10.8333V5.83333C10.8333 6.29167 10.6701 6.68403 10.3438 7.01042C10.0174 7.33681 9.625 7.5 9.16667 7.5H7.5C7.04167 7.5 6.64931 7.33681 6.32292 7.01042C5.99653 6.68403 5.83333 6.29167 5.83333 5.83333V5.83333H1.66667V5.83333V5.83333V15V15V15V15M3.33333 13.3333H8.33333V12.9583C8.33333 12.7222 8.26736 12.5035 8.13542 12.3021C8.00347 12.1007 7.81944 11.9444 7.58333 11.8333C7.30556 11.7083 7.02431 11.6146 6.73958 11.5521C6.45486 11.4896 6.15278 11.4583 5.83333 11.4583C5.51389 11.4583 5.21181 11.4896 4.92708 11.5521C4.64236 11.6146 4.36111 11.7083 4.08333 11.8333C3.84722 11.9444 3.66319 12.1007 3.53125 12.3021C3.39931 12.5035 3.33333 12.7222 3.33333 12.9583V13.3333V13.3333M10 12.0833H13.3333V10.8333H10V12.0833V12.0833M5.83333 10.8333C6.18056 10.8333 6.47569 10.7118 6.71875 10.4688C6.96181 10.2257 7.08333 9.93056 7.08333 9.58333C7.08333 9.23611 6.96181 8.94097 6.71875 8.69792C6.47569 8.45486 6.18056 8.33333 5.83333 8.33333C5.48611 8.33333 5.19097 8.45486 4.94792 8.69792C4.70486 8.94097 4.58333 9.23611 4.58333 9.58333C4.58333 9.93056 4.70486 10.2257 4.94792 10.4688C5.19097 10.7118 5.48611 10.8333 5.83333 10.8333V10.8333M10 9.58333H13.3333V8.33333H10V9.58333V9.58333M7.5 5.83333H9.16667V1.66667H7.5V5.83333V5.83333M8.33333 10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167V10.4167" fill="#8B92A4"/></svg>
          <b>{{ accountSummary }}</b>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
      </header>
      <van-tabs v-model:active="activeList" class="equity-list-tabs" :ellipsis="false" :swipe-threshold="3" :duration="0">
        <van-tab v-for="list in listTabs" :key="list.key" :name="list.key" :title="`${list.label}（${records[list.key].length}）`">
          <template #title><span class="equity-tab-title"><span>{{ list.label }}</span><span class="equity-tab-total app-numeric">{{ records[list.key].length }}</span></span></template>
          <div class="equity-tab-panel">
            <div class="equity-toolbar">
              <form class="equity-quick-search" @submit.prevent="search(list.key)">
                <div class="equity-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input v-model="searchDrafts[list.key]" :aria-label="`${list.label}标的搜索`" :placeholder="list.key === 'positions' ? '代码 / 名称' : '标的名称 / 代码'" enterkeyhint="search" autocomplete="off"></div>
                <button type="submit" class="equity-search-submit">查询</button>
              </form>
              <button type="button" class="equity-filter-trigger" :class="{ 'is-filtered': advancedFilterCount(list.key, applied[list.key]) }" :aria-label="`${list.label}筛选`" @click="openFilters(false, $event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg><span>筛选</span><i v-if="advancedFilterCount(list.key, applied[list.key])">{{ advancedFilterCount(list.key, applied[list.key]) }}</i></button>
            </div>
            <div class="equity-view-toolbar">
              <span>{{ displayMode === 'cards' ? '点按卡片查看详情' : list.key === 'positions' ? '点按行展开操作 · 左右滑动查看' : '标的列固定 · 左右滑动查看' }}</span>
              <div class="equity-view-switch" role="group" aria-label="列表展示方式">
                <button type="button" :aria-pressed="displayMode === 'cards'" @click="displayMode = 'cards'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="18" height="7" rx="1"/></svg><span>卡片视图</span></button>
                <button type="button" :aria-pressed="displayMode === 'table'" @click="displayMode = 'table'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 9v12"/></svg><span>表格视图</span></button>
              </div>
            </div>
            <EquityRecordsTable v-if="displayMode === 'table' && records[list.key].length" :kind="list.key" :records="records[list.key]" @open="({ record, index, event }) => openDetail(list.key, record, index, event)" @action="({ record, action, event }) => openPositionAction(record, { action, event })" />
            <div v-else class="equity-records" :aria-label="`${list.label}列表`" tabindex="0">
              <EquityRecordCard v-for="(record, index) in records[list.key]" :key="record.id" :kind="list.key" :record="record" @open="openDetail(list.key, record, index + 1, $event)" @action="openPositionAction(record, $event)" />
              <div v-if="!records[list.key].length" class="equity-empty"><ExceptionState type="empty" :description="list.empty" compact :show-action="false" /><van-button v-if="filterCount(list.key, applied[list.key])" size="small" plain @click="resetFilters">重置筛选</van-button></div>
              <p v-else class="equity-list-end">已显示全部 {{ records[list.key].length }} 条 · 点按查看详情</p>
            </div>
          </div>
        </van-tab>
      </van-tabs>
      <button v-show="!isOverlayOpen" type="button" class="equity-order-entry" aria-label="下单" aria-haspopup="dialog" @click="openOrderEntry"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l4 4v4M13 3v5h5M7 11h4M7 15h3M17 14v8M13 18h8"/></svg><span>下单</span></button>
    </div>
    <EquityDetail v-if="selectedRecord" :kind="selectedRecord.kind" :record="selectedRecord.row" :index="selectedRecord.index" @back="closeDetail" />
    <EquityFilters v-model:show="filterVisible" :account-only="accountOnly" :kind="activeList" :filters="{ ...applied[activeList], symbol: searchDrafts[activeList] }" :selected-accounts="selectedAccounts" @apply="applyFilters" @reset="resetFilters" @closed="restoreFocus" />
    <EquityOrderEntry v-if="orderEntryContext" v-model:show="isActionVisible" :context="orderEntryContext" @closed="restoreFocus" />
  </section>
</template>
