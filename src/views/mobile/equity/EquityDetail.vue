<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, ref } from 'vue'
import { showAppMessage } from '../../../plugins/message.js'
import { detailSections, listTabs } from './model.js'
import { recordTableColumns } from './recordTableColumns.js'
import EquityOrderStatus from './EquityOrderStatus.vue'
const props = defineProps({ kind: { type: String, required: true }, record: { type: Object, required: true }, index: { type: Number, required: true }, drawer: Boolean, priorityContent: Boolean })
const emit = defineEmits(['back', 'action'])
const sections = computed(() => detailSections(props.kind, props.record, props.index))
// 持仓抽屉沿用外部基线表格的列顺序，表外补充字段放在末尾。
const displayedSections = computed(() => {
  if (props.priorityContent) {
    const keys = props.kind === 'positions' ? ['floatingProfit', 'value', 'qty', 'available', 'price', 'opening'] : props.kind === 'orders' ? ['status', 'price', 'quantity', 'filledQuantity', 'filledPrice', 'fillProgress'] : ['filledPrice', 'filledQuantity', 'filledAmount', 'filledTime']
    const all = sections.value.flatMap(section => section.fields)
    return [{ title: props.kind === 'positions' ? '持仓概况' : props.kind === 'orders' ? '委托与成交' : '成交概况', fields: keys.map(key => all.find(field => field.key === key)).filter(Boolean) }, ...sections.value.map(section => ({ ...section, fields: section.fields.filter(field => !keys.includes(field.key)) })).filter(section => section.fields.length)]
  }
  if (!props.drawer || props.kind !== 'positions') return sections.value
  const fields = new Map(sections.value.flatMap(section => section.fields).map(field => [field.key, field]))
  const aliases = { holdingQty: ['qty', 'available'], valueWan: ['value'] }
  const keys = ['name', 'code', ...recordTableColumns('positions', 'baseline').flatMap(column => aliases[column.key] || [column.key])]
  return [
    { title: '持仓信息', fields: keys.map(key => fields.get(key)).filter(Boolean) },
    ...sections.value.map(section => ({ ...section, title: section.title === '市值与盈亏' ? '其他盈亏' : section.title, fields: section.fields.filter(field => !keys.includes(field.key)) })).filter(section => section.fields.length),
  ]
})
const closeButton = ref(null)
defineExpose({ focusClose: () => closeButton.value?.focus() })
function handleKeyboard(event) {
  if (!props.drawer) return
  if (event.key === 'Escape') { event.preventDefault(); emit('back'); return }
  if (event.key !== 'Tab') return
  const elements = [...event.currentTarget.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length)
  const first = elements[0], last = elements.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
async function copyIdentifier(field) {
  try {
    // 内嵌浏览器可能将 Clipboard API 的 Promise 视为成功却未写入系统剪贴板。
    // 优先在本次点击手势内同步复制，受限时再使用标准异步 API。
    const input = document.createElement('textarea')
    const previousFocus = document.activeElement
    let copied = false
    try {
      input.value = String(field.value)
      input.readOnly = true
      input.style.cssText = 'position:fixed;left:-9999px;top:0;font-size:16px'
      document.body.append(input)
      input.select()
      input.setSelectionRange(0, input.value.length)
      copied = document.execCommand?.('copy') === true
    } catch {
      copied = false
    } finally {
      input.remove()
      previousFocus?.focus({ preventScroll: true })
    }
    if (!copied) await navigator.clipboard.writeText(String(field.value))
    showAppMessage(`已复制：${field.value}`)
  } catch { showAppMessage('复制失败，请长按编号手动复制', 'error') }
}
</script>

<template>
  <section class="equity-detail" :class="{ 'equity-detail--drawer': drawer }" :aria-label="listTabs.find(tab => tab.key === kind).detail" @keydown="handleKeyboard">
    <header v-if="drawer" class="position-detail-header">
      <div class="position-detail-identity"><h2>{{ record.name }}</h2><p class="position-detail-meta"><span class="app-numeric">{{ record.code }}.{{ record.market }}</span> · {{ record.currency }}</p><span class="position-detail-direction">{{ record.direction === '多' ? '做多' : '做空' }}</span></div>
      <EquitySheetClose ref="closeButton" aria-label="关闭持仓详情" @click="$emit('back')" />
    </header>
    <header v-else class="detail-header"><button type="button" class="equity-icon-button" aria-label="返回列表" @click="$emit('back')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg></button><h2>{{ listTabs.find(tab => tab.key === kind).detail }}</h2><span></span></header>
    <div class="detail-scroll" :tabindex="priorityContent ? 0 : undefined" :role="priorityContent ? 'region' : undefined" :aria-label="priorityContent ? '完整记录信息，可滚动查看' : undefined">
      <div v-if="!drawer" class="detail-symbol"><h3>{{ record.name }}</h3><span class="app-numeric">{{ record.code }}.{{ record.market }}<template v-if="priorityContent"> · {{ record.currency }}</template></span></div>
      <section v-for="section in displayedSections" :key="section.title" class="detail-section">
        <h3>{{ section.title }}</h3>
        <dl><div v-for="field in section.fields" :key="field.key" class="detail-field" :class="{ 'detail-field-long': field.multiline }"><dt>{{ field.label }}</dt><dd :class="field.tone"><EquityOrderStatus v-if="field.key === 'status'" :status="record.status" /><span v-else :class="{ 'copyable-value': field.copyable, 'app-numeric': field.numeric }">{{ field.value }}</span><button v-if="field.copyable" type="button" class="equity-icon-button copy-button" :aria-label="`复制${field.label}`" @click="copyIdentifier(field)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg></button></dd></div></dl>
        <p v-if="kind !== 'positions' && section.title === '备注'" class="activity-description">订单动态合并展示系统反馈和交易员备注。</p>
      </section>
    </div>
    <footer v-if="drawer && record.direction === '多'" class="position-detail-actions"><button type="button" @click="$emit('action', { action: 'close' })">平仓</button></footer>
  </section>
</template>
