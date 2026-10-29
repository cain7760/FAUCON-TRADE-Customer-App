<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { addSearchHistory, filterSymbolRecords, normalizeSymbolHistory, symbolHistoryLabel } from './symbolSearch.js'
import './symbol-picker.css'

const props = defineProps({
  active: Boolean, instruments: { type: Array, required: true },
  positionCodes: { type: Array, required: true }, selectedCode: String, allowManual: Boolean,
})
const emit = defineEmits(['select', 'manual', 'close'])
const searchInput = ref(null), search = ref(''), category = ref('all')
const historyKey = 'faucon:order-symbol-search-history'
function readHistory() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(historyKey) || '[]')
    return normalizeSymbolHistory(props.instruments, stored)
  } catch { return [] }
}
// 只保存在当前浏览器标签页；存储不可用时仍可在内存中使用。
const history = ref(readHistory())
const positionRows = computed(() => props.instruments.filter(row => props.positionCodes.includes(row.code)))
const positionCount = computed(() => new Set(positionRows.value.map(row => `${row.code}.${row.market}`)).size)
const tabs = [
  { id: 'all', label: '全部' },
  { id: 'positions', label: '持仓标的' },
]
const rows = computed(() => filterSymbolRecords(category.value === 'positions' ? positionRows.value : props.instruments, search.value))
function focusSearch() { searchInput.value?.focus() }
function rememberSymbol(row) {
  history.value = addSearchHistory(history.value, `${row.code}.${row.market}`)
  try { sessionStorage.setItem(historyKey, JSON.stringify(history.value)) } catch { /* 保留内存中的历史。 */ }
}
function submitSearch() { searchInput.value?.blur() }
function select(row) { rememberSymbol(row); emit('select', row) }
function repeatSearch(value) { search.value = value; category.value = 'all'; nextTick(focusSearch) }
function clearHistory() {
  history.value = []
  try { sessionStorage.removeItem(historyKey) } catch { /* 内存中的历史已清空。 */ }
  nextTick(focusSearch)
}
function chooseCategory(value) { category.value = value; search.value = '' }
function addManual() { emit('manual', search.value) }
watch(() => props.active, active => { if (active) { search.value = ''; category.value = 'all' } })
defineExpose({ focusSearch })
</script>

<template>
  <section class="symbol-picker" :inert="!active ? true : undefined" aria-label="标的搜索">
    <header class="symbol-picker-heading">
      <h2>标的搜索</h2>
      <EquitySheetClose aria-label="关闭标的搜索弹窗" @click="emit('close')" />
    </header>
    <form class="symbol-picker-search" role="search" @submit.prevent="submitSearch">
      <div class="symbol-search-control">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input ref="searchInput" v-model="search" aria-label="搜索下单标的" placeholder="搜索标的名称/代码" maxlength="80" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <button v-if="search" type="button" class="symbol-icon-button" aria-label="清空标的搜索" @click="search = ''; focusSearch()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
      </div>
    </form>
    <section class="symbol-search-history" aria-label="搜索历史">
      <div class="symbol-history-heading"><h3>搜索历史</h3><button v-if="history.length" type="button" @click="clearHistory">清空历史</button></div>
      <div v-if="history.length" class="symbol-history-terms" aria-label="搜索历史记录"><button v-for="term in history" :key="term" type="button" :aria-label="`重新搜索 ${symbolHistoryLabel(instruments, term)}`" @click="repeatSearch(term)">{{ symbolHistoryLabel(instruments, term) }}</button></div>
      <p v-else class="symbol-history-empty" role="status">暂无搜索历史</p>
    </section>
    <nav class="symbol-picker-tabs" aria-label="标的分类"><button v-for="tab in tabs" :key="tab.id" type="button" :aria-pressed="category === tab.id" @click="chooseCategory(tab.id)">{{ tab.label }}<span v-if="tab.id === 'positions'" class="equity-tab-total app-numeric">{{ positionCount }}</span></button></nav>
      <div class="symbol-list-caption" aria-hidden="true"><span>标的名称</span><span>代码</span></div>
      <div class="symbol-picker-results" aria-label="标的搜索结果">
        <button v-for="row in rows" :key="row.code" type="button" class="symbol-select" :class="{ 'is-current': selectedCode === row.code }" :aria-label="`选择${row.name} ${row.code}`" :aria-current="selectedCode === row.code ? 'true' : undefined" @click="select(row)"><span class="symbol-name">{{ row.name }}</span><span class="symbol-code app-numeric">{{ row.code }}.{{ row.market }}</span></button>
        <div v-if="!rows.length" class="symbol-picker-empty" role="status"><p>{{ category === 'positions' && !search.trim() ? '暂无持仓标的' : '暂无匹配标的' }}</p><button v-if="allowManual && search.trim()" type="button" @click="addManual">手动新增标的</button><button v-else type="button" @click="chooseCategory('all')">查看全部标的</button></div>
      </div>
  </section>
</template>
