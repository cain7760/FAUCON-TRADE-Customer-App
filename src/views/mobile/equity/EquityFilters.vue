<script setup>
import { computed, ref, watch } from 'vue'
import { accounts } from './fixtures.js'
import { defaultFilters, filterGroups, orderStatuses } from './model.js'

const props = defineProps({ show: Boolean, accountOnly: Boolean, kind: { type: String, required: true }, filters: { type: Object, required: true }, selectedAccounts: { type: Array, required: true } })
const emit = defineEmits(['update:show', 'apply', 'reset', 'closed'])
const draft = ref(defaultFilters())
const draftAccounts = ref([])
const closeButton = ref(null)
const allAccountsSelected = computed(() => draftAccounts.value.length === accounts.length)
watch(() => props.show, show => {
  if (!show) return
  draft.value = { ...props.filters, status: [...props.filters.status] }
  draftAccounts.value = [...props.selectedAccounts]
})
function toggleAccount(id) { draftAccounts.value = draftAccounts.value.includes(id) ? draftAccounts.value.filter(value => value !== id) : [...draftAccounts.value, id] }
function toggleStatus(status) { draft.value.status = draft.value.status.includes(status) ? draft.value.status.filter(value => value !== status) : [...draft.value.status, status] }
function resetFilters() { draft.value = defaultFilters(); emit('reset') }
function apply() {
  if (!draftAccounts.value.length) return
  emit('apply', { filters: { ...draft.value, status: [...draft.value.status] }, accounts: [...draftAccounts.value] })
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
  <van-popup :show="show" position="bottom" round class="equity-filter-sheet" overlay-class="equity-sheet-overlay" :duration=".2" aria-label="筛选面板" @update:show="emit('update:show', $event)" @opened="closeButton?.focus()" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="sheet-heading"><h2>{{ accountOnly ? '下单账户' : kind === 'positions' ? '持仓筛选' : kind === 'orders' ? '订单筛选' : '成交筛选' }}</h2><button ref="closeButton" type="button" class="equity-icon-button" aria-label="关闭筛选" @click="emit('update:show', false)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
    <form class="filter-form" @submit.prevent="apply">
      <div class="filter-scroll">
        <fieldset class="filter-group">
          <legend class="app-form-label">下单账户 <small>可多选 · 对三个列表生效</small></legend>
          <div class="account-options">
            <button type="button" class="account-option" :aria-pressed="allAccountsSelected" @click="draftAccounts = allAccountsSelected ? [] : accounts.map(item => item.id)"><span>全部账户</span><span class="option-check" aria-hidden="true">{{ allAccountsSelected ? '✓' : '' }}</span></button>
            <button v-for="account in accounts" :key="account.id" type="button" class="account-option" :aria-pressed="draftAccounts.includes(account.id)" @click="toggleAccount(account.id)"><span>{{ account.name }}<small>{{ account.id }}</small></span><span class="option-check" aria-hidden="true">{{ draftAccounts.includes(account.id) ? '✓' : '' }}</span></button>
          </div>
          <p v-if="!draftAccounts.length" class="filter-error" role="status">请至少选择一个下单账户</p>
        </fieldset>
        <template v-if="!accountOnly">
          <div class="filter-group"><label class="app-form-label" for="equity-filter-symbol">{{ kind === 'positions' ? '代码 / 名称' : '标的名称 / 代码' }}</label><van-field id="equity-filter-symbol" v-model="draft.symbol" placeholder="请输入名称或代码" class="equity-filter-input" autocomplete="off" /></div>
          <div v-if="kind === 'orders'" class="filter-group"><label class="app-form-label" for="equity-filter-order-no">订单编号</label><van-field id="equity-filter-order-no" v-model="draft.orderNo" placeholder="请输入订单编号" class="equity-filter-input" autocomplete="off" /></div>
          <fieldset v-for="group in filterGroups[kind]" :key="group.key" class="filter-group">
            <legend class="app-form-label">{{ group.label }}</legend>
            <div class="filter-options"><button v-for="option in group.options" :key="option.value" type="button" class="filter-chip" :aria-pressed="draft[group.key] === option.value" @click="draft[group.key] = option.value">{{ option.label }}</button></div>
          </fieldset>
          <fieldset v-if="kind === 'orders'" class="filter-group">
            <legend class="app-form-label">订单状态 <small>可多选</small></legend>
            <div class="status-selection"><button type="button" @click="draft.status = [...new Set(orderStatuses)]">全选</button><button type="button" @click="draft.status = [...new Set(orderStatuses.filter(status => !draft.status.includes(status)))]">反选</button><span>未选择时展示全部</span></div>
            <div class="filter-options status-options"><button v-for="(status, index) in orderStatuses" :key="index" type="button" class="filter-chip" :aria-pressed="draft.status.includes(status)" @click="toggleStatus(status)">{{ status }}</button></div>
          </fieldset>
        </template>
      </div>
      <footer class="sheet-actions"><van-button v-if="!accountOnly" class="equity-secondary-button" @click="resetFilters">重置</van-button><van-button type="primary" native-type="submit" :disabled="!draftAccounts.length">{{ accountOnly ? '确认' : '查询' }}</van-button></footer>
    </form>
  </van-popup>
</template>
