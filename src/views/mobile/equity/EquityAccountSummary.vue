<script setup>
import { computed, useId } from 'vue'
import { formatNumber, pnlClass } from './model.js'

const props = defineProps({ summary: { type: Object, required: true }, visible: Boolean, collapsed: Boolean })
const emit = defineEmits(['update:visible', 'update:collapsed'])
const detailsId = useId()
const metrics = computed(() => [
  { key: 'available', label: '大账户实时可用' },
  { key: 'marketValue', label: '持仓市值' },
  { key: 'floatingProfit', label: '浮动盈亏', tone: pnlClass(props.summary.floatingProfit) },
])
</script>

<template>
  <section class="ticket-account-summary" aria-label="资产账户概要">
    <div class="ticket-account-summary-heading">
      <span class="ticket-account-summary-title">资产账户概要</span>
      <button type="button" class="ticket-summary-eye" :aria-label="visible ? '隐藏资金数值' : '查看资金数值'" @click="emit('update:visible', !visible)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="!visible" d="m3 3 18 18"/></svg>
      </button>
      <button type="button" class="ticket-summary-collapse" :aria-expanded="!collapsed" :aria-controls="detailsId" :aria-label="`${collapsed ? '展开' : '收起'}资产账户概要`" @click="emit('update:collapsed', !collapsed)">
        {{ collapsed ? '展开' : '收起' }}<span class="app-chevron" :class="{ 'app-chevron--up': !collapsed }" aria-hidden="true"></span>
      </button>
    </div>
    <dl v-show="!collapsed" :id="detailsId">
      <div v-for="metric in metrics" :key="metric.key">
        <dt>{{ metric.label }}</dt>
        <dd><span :class="visible ? metric.tone : undefined">{{ visible ? formatNumber(summary[metric.key], 2) : '••••••••' }}</span><small>CNY</small></dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.ticket-account-summary { margin-top: 10px; padding-top: 4px; border-top: 1px solid var(--app-color-border); }
.ticket-account-summary-heading { display: flex; min-height: 36px; align-items: center; gap: 2px; }
.ticket-account-summary-title { color: var(--app-color-text); font-size: 12px; }
.ticket-account-summary-heading button { display: inline-flex; min-width: 36px; min-height: 36px; align-items: center; justify-content: center; gap: 4px; padding: 0 6px; border: 0; border-radius: 3px; background: none; color: var(--app-color-text-secondary); font-size: 12px; }
.ticket-account-summary-heading button:active { background: var(--app-color-control); }
.ticket-account-summary-heading button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.ticket-account-summary-heading .ticket-summary-collapse { min-width: 60px; margin-left: auto; padding-right: var(--app-chevron-inset); }
.ticket-account-summary-heading svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
dl { display: grid; gap: 4px; margin: 0; }
dl > div { display: flex; min-width: 0; min-height: 24px; align-items: baseline; flex-wrap: wrap; gap: 2px 12px; }
dt { flex-shrink: 0; color: var(--app-color-text-secondary); font-size: 12px; line-height: 20px; }
dd { min-width: 0; max-width: 100%; margin: 0 0 0 auto; font-family: var(--app-font-family-numeric); font-size: 14px; line-height: 22px; text-align: right; overflow-wrap: anywhere; }
/* 现有 D-DIN Exp 仅提供常规字重；仅金额允许合成粗体，币种及其他数值不变。 */
dd > span { font-weight: 700; font-synthesis: weight; }
dd small { margin-left: 6px; color: var(--app-color-text-secondary); font-size: 12px; white-space: nowrap; }
</style>
