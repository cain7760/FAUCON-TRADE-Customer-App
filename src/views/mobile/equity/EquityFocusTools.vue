<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { listTabs } from './model.js'
import { focusCsv, focusDefaultColumnKeys, focusTableColumns } from './focusTableColumns.js'

const props = defineProps({ kind: { type: String, required: true }, records: { type: Array, required: true }, modelValue: { type: Array, default: null }, columnsOverride: { type: Array, default: null }, csvOverride: { type: Object, default: null }, labelOverride: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'columns-saved', 'refresh', 'overlay-change'])
const visible = ref(false), page = ref('tools'), feedback = ref('')
const draft = ref([]), draftOrder = ref([]), trigger = ref(null), closeButton = ref(null)
// 离开会被父层 inert 的列表工作区，仍挂载在同一手机页面内，不使用 body。
const popupContainer = computed(() => trigger.value?.closest('.equity-page'))
const columns = computed(() => props.columnsOverride || focusTableColumns(props.kind))
const label = computed(() => props.labelOverride || listTabs.find(item => item.key === props.kind).label)
const title = computed(() => page.value === 'columns' ? '自定义列' : `${label.value}管理`)
const labels = computed(() => Object.fromEntries(columns.value.map(column => [column.key, column.secondTitle ? `${column.title} / ${column.secondTitle}` : column.title])))
watch(visible, value => emit('overlay-change', value))
onBeforeUnmount(() => { if (visible.value) emit('overlay-change', false) })
function open() { page.value = 'tools'; feedback.value = ''; visible.value = true }
function prepareColumns(keys = props.modelValue ?? focusDefaultColumnKeys(props.kind)) {
  const known = columns.value.map(column => column.key)
  draft.value = keys.filter(key => known.includes(key))
  draftOrder.value = [...draft.value, ...known.filter(key => !draft.value.includes(key))]
  page.value = 'columns'
  nextTick(() => closeButton.value?.focus())
}
function moveColumn(index, offset) {
  const next = index + offset
  if (next < 0 || next >= draftOrder.value.length) return
  const items = [...draftOrder.value]
  ;[items[index], items[next]] = [items[next], items[index]]
  draftOrder.value = items
}
function saveColumns() {
  const keys = draftOrder.value.filter(key => draft.value.includes(key))
  visible.value = false
  // 保存后父层可能立即切到表格并卸载该工具，先同步释放背景交互锁。
  emit('overlay-change', false)
  emit('update:modelValue', keys)
  emit('columns-saved', keys)
}
function refresh() { emit('refresh'); visible.value = false }
function exportCsv() {
  const csv = props.csvOverride || focusCsv(props.kind, props.records)
  const href = URL.createObjectURL(new Blob([csv.content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = href; link.download = csv.filename; link.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
  feedback.value = `已导出当前筛选的 ${props.records.length} 条记录，包含完整字段。`
}
function handleKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); visible.value = false; return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(element => element.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>

<template>
  <button ref="trigger" type="button" class="focus-more-button" :aria-label="`${label}更多操作`" aria-haspopup="dialog" @click="open"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
  <van-popup v-model:show="visible" :teleport="popupContainer" position="bottom" round class="equity-filter-sheet focus-tools-sheet" :class="{ 'focus-tools-sheet--columns': page === 'columns' }" overlay-class="equity-sheet-overlay" :duration=".2" :aria-label="title" aria-modal="true" @opened="closeButton?.focus()" @closed="nextTick(() => trigger?.focus())" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="sheet-heading"><h2>{{ title }}</h2><EquitySheetClose ref="closeButton" :aria-label="`关闭${title}`" @click="visible = false" /></header>
    <template v-if="page === 'tools'">
      <div class="focus-tools-actions">
        <button type="button" @click="refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.5 7a7 7 0 0 1 12-2L20 8M4 16l2.5 3a7 7 0 0 0 12-2"/></svg><span><strong>刷新列表</strong></span><span class="app-chevron" aria-hidden="true"></span></button>
        <button type="button" @click="exportCsv"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg><span><strong>导出 CSV</strong></span><span class="app-chevron" aria-hidden="true"></span></button>
        <button type="button" @click="prepareColumns()"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg><span><strong>自定义表格列</strong></span><span class="app-chevron" aria-hidden="true"></span></button>
      </div>
      <p v-if="feedback" role="status" class="focus-tools-feedback">{{ feedback }}</p>
    </template>
    <template v-else>
      <div class="focus-columns-heading"><span>已选 {{ draft.length }} 项</span><button type="button" @click="prepareColumns(focusDefaultColumnKeys(kind))">恢复默认</button></div>
      <div class="focus-columns-scroll">
        <div v-for="(key, index) in draftOrder" :key="key" class="focus-column-row">
          <label><input v-model="draft" type="checkbox" :value="key"><span>{{ labels[key] }}</span></label>
          <button type="button" :disabled="index === 0" :aria-label="`上移${labels[key]}`" @click="moveColumn(index, -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
          <button type="button" :disabled="index === draftOrder.length - 1" :aria-label="`下移${labels[key]}`" @click="moveColumn(index, 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>
        </div>
      </div>
      <footer class="focus-columns-footer"><button type="button" @click="visible = false">取消</button><button type="button" @click="saveColumns">保存</button></footer>
    </template>
  </van-popup>
</template>

<style scoped>
.focus-more-button { display: grid; width: 44px; min-width: 44px; height: 44px; place-items: center; border: 0; border-radius: 8px; background: var(--app-color-control); color: var(--app-color-text-secondary); }
.focus-more-button svg { width: 22px; height: 22px; fill: currentColor; }
.focus-tools-sheet { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
.focus-tools-sheet--columns { height: min(680px, calc(100% - 59px)); }
.focus-tools-actions { padding: 0 20px 8px; }
.focus-tools-actions > button { display: flex; width: 100%; min-height: 76px; align-items: center; gap: 16px; padding: 14px 0; border: 0; border-bottom: 1px solid var(--app-color-border); background: transparent; color: var(--app-color-text); text-align: left; }
.focus-tools-actions > button:last-child { border-bottom: 0; }
.focus-tools-actions > button > svg { width: 22px; height: 22px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.focus-tools-actions strong { display: block; }
.focus-tools-actions strong { font-size: 15px; font-weight: 500; line-height: 22px; }
.focus-tools-actions .app-chevron { margin-left: auto; transform: rotate(-90deg); }
.focus-tools-feedback { margin: 0; padding: 0 20px 12px; color: var(--app-color-accent); font-size: 12px; line-height: 20px; }
.focus-columns-heading { display: flex; min-height: 44px; flex-shrink: 0; align-items: center; justify-content: space-between; padding: 0 20px; color: var(--app-color-text-secondary); font-size: 12px; }
.focus-columns-heading button { min-height: 44px; padding: 0; border: 0; background: none; color: var(--app-color-accent); font: inherit; }
.focus-columns-scroll { min-height: 0; flex: 1; overflow: auto; overscroll-behavior: contain; padding: 0 20px; }
.focus-column-row { display: flex; min-height: 52px; align-items: center; gap: 4px; border-bottom: 1px solid var(--app-color-border); }
.focus-column-row label { display: flex; min-width: 0; min-height: 52px; flex: 1; align-items: center; gap: 12px; font-size: 14px; line-height: 20px; cursor: pointer; }
.focus-column-row input { width: 18px; height: 18px; flex-shrink: 0; margin: 0; accent-color: var(--app-color-accent); }
.focus-column-row button { display: grid; width: 44px; height: 44px; flex-shrink: 0; place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--app-color-text-secondary); }
.focus-column-row button:disabled { opacity: .3; }
.focus-column-row svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.focus-columns-footer { display: flex; flex-shrink: 0; gap: 12px; padding: 12px 20px 4px; border-top: 1px solid var(--app-color-border); }
.focus-columns-footer button { min-height: 44px; flex: 1; padding: 8px 16px; border: 0; border-radius: 8px; background: var(--app-color-control); color: var(--app-color-text); font: inherit; font-size: 15px; }
.focus-columns-footer button:last-child { border: 1px solid var(--app-color-accent); background: var(--app-color-accent-soft); color: var(--app-color-accent); font-weight: 600; }
.focus-more-button:focus-visible, .focus-tools-sheet :is(button, input):focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.focus-more-button:active, .focus-tools-sheet button:enabled:active { filter: brightness(.85); }
</style>
