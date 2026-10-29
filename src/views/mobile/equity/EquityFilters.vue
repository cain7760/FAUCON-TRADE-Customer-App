<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { accounts } from './fixtures.js'
import { defaultFilters, filterGroups, orderStatuses } from './model.js'

const props = defineProps({ show: Boolean, accountOnly: Boolean, includeAccounts: Boolean, kind: { type: String, required: true }, filters: { type: Object, required: true }, selectedAccounts: { type: Array, required: true }, teleport: { default: undefined }, titleOverride: String, defaults: Object, accountScopeLabel: { type: String, default: '对三个列表生效' } })
const emit = defineEmits(['update:show', 'apply', 'reset', 'closed'])
const draft = ref(defaultFilters())
const draftAccounts = ref([])
const accountSearch = ref('')
const filteredAccounts = computed(() => accounts.filter(account => `${account.id} ${account.name}`.toLowerCase().includes(accountSearch.value.trim().toLowerCase())))
const closeButton = ref(null)
const allAccountsSelected = computed(() => draftAccounts.value.length === accounts.length)
watch(() => props.show, show => {
  if (!show) return
  draft.value = { ...props.filters, status: [...props.filters.status], ...(props.filters.range ? { range: [...props.filters.range] } : {}) }
  draftAccounts.value = [...props.selectedAccounts]
  accountSearch.value = ''
})
function toggleAccount(id) { draftAccounts.value = draftAccounts.value.includes(id) ? draftAccounts.value.filter(value => value !== id) : [...draftAccounts.value, id] }
function toggleStatus(status) { draft.value.status = draft.value.status.includes(status) ? draft.value.status.filter(value => value !== status) : [...draft.value.status, status] }
function resetFilters() {
  const initial = props.defaults || defaultFilters()
  draft.value = { ...initial, status: [...initial.status], ...(props.filters.range ? { range: [...(props.defaults?.range || props.filters.range)] } : {}) }
  if (props.includeAccounts) draftAccounts.value = accounts.map(account => account.id)
  emit('reset')
  if (props.filters.range) nextTick(() => { draft.value.range = [...props.filters.range] })
}
function apply() {
  if ((props.accountOnly || props.includeAccounts) && !draftAccounts.value.length) return
  emit('apply', { filters: { ...draft.value, status: [...draft.value.status] }, accounts: [...((props.accountOnly || props.includeAccounts) ? draftAccounts.value : props.selectedAccounts)] })
  emit('update:show', false)
}
function handleKeyboard(event) {
  if (event.key === 'Escape') { emit('update:show', false); return }
  if (event.key !== 'Tab') return
  const elements = [...event.currentTarget.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')].filter(el => el.getClientRects().length)
  const first = elements[0], last = elements.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>

<template>
  <van-popup :show="show" :teleport="teleport" position="bottom" round class="equity-filter-sheet" overlay-class="equity-sheet-overlay" :duration=".2" aria-label="筛选面板" @update:show="emit('update:show', $event)" @opened="closeButton?.focus()" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="sheet-heading"><div class="sheet-heading-copy"><h2>{{ titleOverride || (accountOnly ? '下单账户' : kind === 'positions' ? '持仓筛选' : kind === 'orders' ? '订单筛选' : '成交筛选') }}</h2></div><EquitySheetClose ref="closeButton" aria-label="关闭筛选" @click="emit('update:show', false)" /></header>
    <form class="filter-form" @submit.prevent="apply">
      <div class="filter-scroll">
        <fieldset v-if="accountOnly || includeAccounts" class="filter-group" :aria-label="`下单账户，可多选，${accountScopeLabel}`">
          <legend v-if="includeAccounts && !accountOnly" class="app-form-label">交易账户</legend>
          <van-field v-model="accountSearch" class="equity-filter-input" placeholder="搜索账户名称 / 编号" aria-label="搜索交易账户" clearable />
          <div class="account-options">
            <button type="button" class="account-option" :aria-pressed="allAccountsSelected" @click="draftAccounts = allAccountsSelected ? [] : accounts.map(item => item.id)"><span>全部账户</span><span class="option-check" aria-hidden="true">{{ allAccountsSelected ? '✓' : '' }}</span></button>
            <button v-for="account in filteredAccounts" :key="account.id" type="button" class="account-option" :aria-pressed="draftAccounts.includes(account.id)" @click="toggleAccount(account.id)"><span>{{ account.name }}<small>{{ account.id }}</small></span><span class="option-check" aria-hidden="true">{{ draftAccounts.includes(account.id) ? '✓' : '' }}</span></button>
          </div>
          <p v-if="accountSearch && !filteredAccounts.length" class="filter-error" role="status">无匹配账户</p>
          <p v-if="!draftAccounts.length" class="filter-error" role="status">请至少选择一个下单账户</p>
        </fieldset>
        <template v-if="!accountOnly">
          <slot name="fields" :filters="draft">
          <div v-if="kind !== 'positions'" class="filter-group"><label class="app-form-label" for="equity-filter-symbol">标的名称 / 代码</label><van-field id="equity-filter-symbol" v-model="draft.symbol" placeholder="请输入名称或代码" class="equity-filter-input" autocomplete="off" /></div>
          <div v-if="kind === 'orders'" class="filter-group"><label class="app-form-label" for="equity-filter-order-no">订单编号</label><van-field id="equity-filter-order-no" v-model="draft.orderNo" placeholder="请输入订单编号" class="equity-filter-input" autocomplete="off" /></div>
          <slot name="after-order-number" :filters="draft" />
          <fieldset v-for="group in filterGroups[kind]" :key="group.key" class="filter-group">
            <legend class="app-form-label">{{ group.label }}</legend>
            <div class="filter-options filter-options--segmented"><button v-for="option in group.options" :key="option.value" type="button" class="filter-chip" :aria-pressed="draft[group.key] === option.value" @click="draft[group.key] = option.value">{{ option.label }}</button></div>
          </fieldset>
          <fieldset v-if="kind === 'orders'" class="filter-group">
            <legend class="app-form-label filter-status-heading"><span>订单状态</span><span class="status-selection status-selection--inline"><button type="button" @click="draft.status = [...new Set(orderStatuses)]">全选</button><button type="button" @click="draft.status = [...new Set(orderStatuses.filter(status => !draft.status.includes(status)))]">反选</button></span></legend>
            <div class="filter-options status-options"><button v-for="(status, index) in orderStatuses" :key="index" type="button" class="filter-chip" :aria-pressed="draft.status.includes(status)" @click="toggleStatus(status)">{{ status }}</button></div>
          </fieldset>
          </slot>
        </template>
      </div>
      <footer class="sheet-actions"><van-button v-if="!accountOnly" class="equity-secondary-button" @click="resetFilters">重置</van-button><van-button type="primary" native-type="submit" :disabled="(accountOnly || includeAccounts) && !draftAccounts.length">{{ accountOnly ? '确认' : '查询' }}</van-button></footer>
    </form>
  </van-popup>
</template>
