import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { createHistoryDemo } from './historyFixtures.js'
import { cloneHistoryFilters, defaultHistoryFilters, filterHistoryRecords, historyColumns, historyCsv, historyToday, sortHistoryRecords, validateHistoryRange } from './historyModel.js'
import { captureHistoryRecords } from './historySnapshot.js'

export function useHistoryRecords({ readSource = () => ({}), accounts = [], now = () => new Date() } = {}) {
  const today = ref(historyToday(now()))
  const archive = createHistoryDemo(today.value)
  const records = shallowRef(captureHistoryRecords(archive, readSource(), accounts))
  const kind = ref('orders')
  const states = reactive(Object.fromEntries(['orders', 'trades'].map(key => {
    const draft = defaultHistoryFilters(today.value)
    return [key, { draft, applied: cloneHistoryFilters(draft), page: 1, pageSize: 20, sort: {}, error: '' }]
  })))
  const state = computed(() => states[kind.value])
  const draft = computed(() => state.value.draft)
  const accountIds = computed({ get: () => draft.value.accounts, set: ids => { draft.value.accounts = [...ids] } })
  const columns = computed(() => historyColumns[kind.value])
  const rows = computed(() => sortHistoryRecords(kind.value, filterHistoryRecords(kind.value, records.value[kind.value], state.value.applied, today.value), state.value.sort))
  const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / state.value.pageSize)))
  const pageRows = computed(() => rows.value.slice((state.value.page - 1) * state.value.pageSize, state.value.page * state.value.pageSize))
  const maxDate = computed(() => today.value)
  watch([rows, () => state.value.pageSize], () => { state.value.page = Math.min(state.value.page, pages.value) })
  function query(syncSource = true) {
    today.value = historyToday(now())
    state.value.error = validateHistoryRange(draft.value.range, today.value)
    if (state.value.error) return false
    if (syncSource) {
      const snapshot = captureHistoryRecords(archive, readSource(), accounts)
      // 两张表各自只在初次打开、查询或刷新时捕获数据；切 Tab/排序/翻页不触发。
      records.value = { ...records.value, [kind.value]: snapshot[kind.value] }
    }
    state.value.applied = cloneHistoryFilters(draft.value)
    state.value.page = 1
    state.value.sort = {}
    return true
  }
  function reset() { state.value.draft = defaultHistoryFilters(historyToday(now())); state.value.sort = {}; return query(false) }
  function sortBy(key, direction) { state.value.sort = { key, direction }; state.value.page = 1 }
  function exportRecords() {
    const csv = historyCsv(kind.value, rows.value, state.value.applied.range)
    if (!csv.count) return 0
    const href = URL.createObjectURL(new Blob([csv.content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = href; link.download = csv.filename; link.click()
    // 下载触发后再回收，避免浏览器尚未消费 URL 时立即撤销。
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    return csv.count
  }
  return { kind, state, draft, columns, rows, pageRows, maxDate, pages, query, reset, sortBy, exportRecords, accountIds }
}
