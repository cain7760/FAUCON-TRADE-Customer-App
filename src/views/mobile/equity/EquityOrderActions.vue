<script setup>
import { computed } from 'vue'
import { orderRowActions } from './orderStatus.js'
const props = defineProps({ record: { type: Object, required: true }, systemRunning: { type: Boolean, default: true }, stacked: Boolean })
const emit = defineEmits(['action'])
const actions = computed(() => orderRowActions(props.record, props.systemRunning))
function invoke(action, event) {
  if (action.disabled) return
  emit('action', { record: props.record, action: action.key, event })
}
</script>

<template>
  <div class="equity-order-row-actions" :class="{ 'equity-order-row-actions--stacked': stacked }" role="group" :aria-label="`${record.name}订单操作 ${record.orderNo}`">
    <slot />
    <button v-for="action in actions" :key="action.key" type="button" :class="`order-action-${action.key}`" :disabled="action.disabled" :title="action.reason || action.label" :aria-label="`${record.name}${action.label} ${record.orderNo}${action.reason ? `，${action.reason}` : ''}`" @click.stop="invoke(action, $event)"><svg v-if="stacked" viewBox="0 0 24 24" aria-hidden="true"><template v-if="action.key === 'amend'"><path d="m14 4 6 6M4 20l4-1 12-12-3-3L5 16l-1 4ZM13 20h7"/></template><template v-else-if="action.key === 'cancel'"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="m8 8 8 8m0-8-8 8"/></template><template v-else><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/></template></svg>{{ action.key === 'amend' ? '改单' : action.key === 'cancel' ? '撤单' : action.label }}</button>
  </div>
</template>

<style scoped>
.equity-order-row-actions { display: flex; align-items: center; justify-content: center; gap: 8px; }
.equity-order-row-actions button { display: grid; min-width: 72px; height: 44px; flex: 1; place-items: center; padding: 0 12px; border: 0; border-radius: 4px; background: transparent; color: var(--app-color-accent); font: inherit; font-size: 12px; cursor: pointer; }
.equity-order-row-actions .order-action-cancel { color: var(--app-color-rise); }
.equity-order-row-actions button:disabled { color: var(--app-color-text-secondary); opacity: .35; cursor: not-allowed; }
.equity-order-row-actions button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.equity-order-row-actions--stacked { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); align-items: stretch; gap: 12px; }
.equity-order-row-actions--stacked :deep(button) { display: flex; min-width: 0; height: 48px; min-height: 48px; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 3px 12px; border-radius: 0; background: transparent; color: var(--app-color-text); font-size: 12px; font-weight: 500; }
.equity-order-row-actions--stacked :deep(svg) { width: 18px; height: 18px; flex: 0 0 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.equity-order-row-actions--stacked :is(.order-action-amend, .order-action-convert) svg { color: var(--app-color-accent); }
.equity-order-row-actions--stacked .order-action-cancel svg { color: var(--app-color-rise); }
.equity-order-row-actions--stacked .order-action-cancel { color: var(--app-color-text); }
.equity-order-row-actions--stacked button:disabled { color: var(--app-color-text-secondary); }
.equity-order-row-actions--stacked button:disabled svg { color: inherit; }
@media (hover: hover) { .equity-order-row-actions:not(.equity-order-row-actions--stacked) button:enabled:hover { background: var(--app-color-accent-soft); } }
</style>
