<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, ref, useId } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { accounts } from './fixtures.js'
import { pnlClass, shares, signedMoney } from './model.js'
import { canCloseConceptCPosition, conceptCPositionAdditionalSections, conceptCPositionMetrics } from './conceptCPosition.js'

const props = defineProps({ record: { type: Object, required: true }, index: { type: Number, default: 1 }, drawer: Boolean })
const emit = defineEmits(['open', 'back', 'action'])
const headingId = useId()
const closeButton = ref(null)
const metrics = computed(() => conceptCPositionMetrics(props.record, props.drawer))
const additionalSections = computed(() => conceptCPositionAdditionalSections(props.record, props.index))
const accountName = computed(() => accounts.find(account => account.id === props.record.account)?.name || props.record.account)
const canClose = computed(() => canCloseConceptCPosition(props.record))
defineExpose({ focusClose: () => closeButton.value?.focus() })
function onKeyboard(event) {
  if (!props.drawer) return
  if (event.key === 'Escape') { event.preventDefault(); emit('back'); return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
}
</script>

<template>
  <section class="concept-c-position" :class="{ 'concept-c-position--drawer': drawer }" :aria-label="drawer ? '持仓详情内容' : `${record.name}持仓卡片`" @keydown="onKeyboard">
    <header v-if="drawer" class="concept-c-detail-heading"><h2 :id="headingId">持仓详情</h2><EquitySheetClose ref="closeButton" aria-label="关闭持仓详情" @click="emit('back')" /></header>
    <component :is="drawer ? 'div' : 'button'" :type="drawer ? undefined : 'button'" class="concept-c-position-body" :class="{ 'concept-c-detail-scroll': drawer }" :role="drawer ? 'region' : undefined" :tabindex="drawer ? 0 : undefined" :aria-label="drawer ? '持仓完整信息，向下滚动查看' : `查看${record.name}持仓详情`" @click="!drawer && emit('open', $event)">
      <div class="concept-c-position-summary">
        <div class="concept-c-position-identity"><h3>{{ record.name }}<ArrowRight v-if="!drawer" aria-hidden="true" /></h3><p><span class="app-numeric">{{ record.code }}.{{ record.market }}</span><template v-if="drawer"> · {{ accountName }}</template></p></div>
        <div class="concept-c-position-profit"><span>浮动盈亏（{{ record.currency }}）</span><strong class="app-numeric" :class="pnlClass(record.floatingProfit)">{{ signedMoney(record.floatingProfit) }}</strong></div>
      </div>
      <dl class="concept-c-position-metrics"><div v-for="field in metrics" :key="field.key"><dt>{{ field.label }}</dt><dd class="app-numeric" :class="field.tone">{{ field.value }}</dd></div></dl>
      <div v-if="drawer" class="concept-c-additional-info">
        <section v-for="section in additionalSections" :key="section.title"><h3>{{ section.title }}</h3><dl><div v-for="field in section.fields" :key="field.key" :class="{ 'is-long': field.multiline }"><dt>{{ field.label }}</dt><dd :class="[field.tone, { 'app-numeric': field.numeric }]">{{ field.value }}</dd></div></dl></section>
      </div>
    </component>
    <footer class="concept-c-position-footer">
      <div class="concept-c-capacity"><span>{{ record.direction === '多' ? '可平仓' : '可用数量' }}</span><strong class="app-numeric">{{ shares(record.available) }}</strong></div>
      <button v-if="record.direction === '多'" type="button" class="concept-c-close-position" :disabled="!canClose" :aria-label="`${record.name}平仓`" :title="canClose ? '进入平仓下单' : '暂无可平仓数量'" @click="emit('action', { action: 'close', event: $event })">平仓</button>
    </footer>
  </section>
</template>
