import { computed, ref, watch } from 'vue'
import { historyToday } from './historyModel.js'
import { cloneConfirmationFilters, createConfirmationRecords, defaultConfirmationFilters, filterConfirmations, groupConfirmations, sortConfirmations, validateConfirmationRange } from './confirmationModel.js'

export function useConfirmationRecords({ now = () => new Date() } = {}) {
  const today = ref(historyToday(now())), records = createConfirmationRecords()
  const draft = ref(defaultConfirmationFilters(today.value)), applied = ref(cloneConfirmationFilters(draft.value))
  const refreshKey = ref(0)
  const page = ref(1), pageSize = ref(20), sort = ref({}), error = ref(''), selected = ref([])
  const rows = computed(() => sortConfirmations(filterConfirmations(records, applied.value, today.value), sort.value))
  const groups = computed(() => groupConfirmations(rows.value))
  const pages = computed(() => Math.max(1, Math.ceil(groups.value.length / pageSize.value)))
  const pageGroups = computed(() => groups.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
  const allSelected = computed(() => pageGroups.value.length > 0 && pageGroups.value.every(group => selected.value.includes(group.documentNo)))
  const partiallySelected = computed(() => !allSelected.value && pageGroups.value.some(group => selected.value.includes(group.documentNo)))
  watch(pageSize, () => { page.value = 1 })
  function query() {
    today.value = historyToday(now())
    error.value = validateConfirmationRange(draft.value.range, today.value)
    if (error.value) return false
    applied.value = cloneConfirmationFilters(draft.value); page.value = 1; selected.value = []; refreshKey.value++
    return true
  }
  function reset() { draft.value = defaultConfirmationFilters(historyToday(now())); sort.value = {}; return query() }
  function sortBy(key, direction) { sort.value = { key, direction }; page.value = 1 }
  function toggleSelection(documentNo) {
    if (!groups.value.some(group => group.documentNo === documentNo)) return
    selected.value = selected.value.includes(documentNo) ? selected.value.filter(id => id !== documentNo) : [...selected.value, documentNo]
  }
  function selectPage(checked) {
    const ids = pageGroups.value.map(group => group.documentNo)
    selected.value = checked ? [...new Set([...selected.value, ...ids])] : selected.value.filter(id => !ids.includes(id))
  }
  return { today, draft, applied, refreshKey, page, pageSize, pages, sort, error, rows, groups, pageGroups, query, reset, sortBy, selected, allSelected, partiallySelected, toggleSelection, selectPage }
}
