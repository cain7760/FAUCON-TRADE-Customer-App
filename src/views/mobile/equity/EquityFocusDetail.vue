<script setup>
import { computed } from 'vue'
import EquityDetail from './EquityDetail.vue'
import { canConvertOrder, orderActionReason } from './orderActions.js'
import { accountLabel, sideLabel } from './model.js'

const props = defineProps({ kind: { type: String, required: true }, record: { type: Object, required: true }, index: { type: Number, required: true }, systemRunning: { type: Boolean, default: true } })
const emit = defineEmits(['back', 'action'])
const actionReason = computed(() => !props.systemRunning ? '系统已中断，暂不可执行交易操作' : props.kind === 'orders' ? orderActionReason(props.record) : '')
function action(value, event) { emit('action', { action: value, event }) }
function onKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); emit('back') }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
}
</script>

<template>
  <section class="focus-detail" aria-label="记录详情" @keydown="onKeyboard">
    <EquityDetail :kind="kind" :record="record" :index="index" priority-content @back="emit('back')" />
    <footer class="focus-detail-footer">
      <div class="focus-detail-context"><span>{{ kind === 'positions' ? (record.direction === '多' ? '做多' : '做空') : sideLabel(record) }}</span><span>{{ accountLabel(record.account) }}</span><strong v-if="kind === 'orders'">{{ record.status }}</strong></div>
      <p v-if="actionReason && (kind !== 'orders' || !canConvertOrder(record, systemRunning) || !systemRunning)" class="focus-action-reason">{{ actionReason }}</p>
      <div class="focus-record-actions">
        <button type="button" @click="action('history', $event)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>历史</button>
        <template v-if="kind === 'positions'">
          <button type="button" :disabled="!systemRunning" @click="action('new', $event)">下单</button>
          <button v-if="record.direction === '多'" type="button" class="focus-action-primary" :disabled="!systemRunning" @click="action('close', $event)">平仓</button>
        </template>
        <template v-else-if="kind === 'orders'">
          <button v-if="canConvertOrder(record, systemRunning)" type="button" class="focus-action-primary" :disabled="!systemRunning" @click="action('convert', $event)">转手工</button>
          <template v-else>
            <button type="button" :disabled="!!actionReason" @click="action('cancel', $event)">撤单</button>
            <button type="button" class="focus-action-primary" :disabled="!!actionReason" @click="action('amend', $event)">改单</button>
          </template>
        </template>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.focus-detail { position: absolute; inset: 59px 0 0; z-index: 6; display: flex; flex-direction: column; background: var(--app-color-background); }
.focus-detail :deep(.equity-detail) { min-height: 0; flex: 1; }
.focus-detail :deep(.detail-header) { min-height: 56px; border: 0; padding: 0 8px; }
.focus-detail :deep(.detail-header h2) { font-size: 16px; }
.focus-detail :deep(.detail-scroll) { padding: 0 20px 16px; }
.focus-detail :deep(.detail-symbol) { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; padding: 16px 0 24px; }
.focus-detail :deep(.detail-symbol h3) { margin: 0; font-size: 24px; font-weight: 600; }
.focus-detail :deep(.detail-section) { margin: 0 0 24px; border: 0; border-radius: 0; background: none; }
.focus-detail :deep(.detail-section > h3) { padding: 0 0 8px; border: 0; font-size: 14px; }
.focus-detail :deep(.detail-section dl) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; padding: 0; }
.focus-detail :deep(.detail-field) { display: block; min-height: 66px; min-width: 0; padding: 10px 0; border-bottom: 0; font-size: 12px; }
.focus-detail :deep(.detail-field dd) { justify-content: flex-start; margin-top: 6px; text-align: left; font-size: 14px; }
.focus-detail :deep(.detail-field .app-numeric) { font-size: 17px; }
.focus-detail :deep(.detail-field-long) { grid-column: 1 / -1; }
.focus-detail :deep(.detail-section:first-of-type) { padding: 16px; border-radius: 12px; background: var(--app-color-surface); }
.focus-detail :deep(.detail-section:first-of-type .detail-field .app-numeric) { font-size: 20px; }
.focus-detail :deep(.activity-description) { padding: 8px 0 0; line-height: 1.6; }
.focus-detail-footer { flex-shrink: 0; padding: 12px 16px 16px; background: var(--app-color-surface); border-top: 1px solid var(--app-color-border); }
.focus-detail-context { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-bottom: 12px; color: var(--app-color-text-secondary); font-size: 11px; }
.focus-detail-context strong { margin-left: auto; color: var(--app-color-text); font-weight: 500; }
.focus-action-reason { margin: 0 0 10px; color: var(--app-color-text-secondary); font-size: 12px; line-height: 18px; }
.focus-record-actions { display: flex; gap: 8px; }
.focus-record-actions button { display: flex; min-width: 0; min-height: 44px; flex: 1; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 1px solid var(--app-color-frame); border-radius: 8px; background: transparent; color: var(--app-color-text); font-size: 14px; font-weight: 600; }
.focus-record-actions button:first-child { max-width: 84px; font-weight: 400; }
.focus-record-actions .focus-action-primary { border-color: var(--app-color-accent); background: var(--app-color-accent-soft); color: var(--app-color-accent); }
.focus-record-actions button:disabled { opacity: .38; }
.focus-record-actions button:enabled:active { filter: brightness(.85); }
.focus-record-actions button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: 2px; }
.focus-record-actions svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
</style>
