<script setup>
import { computed, useId } from 'vue'
import { formatNumber, pnlClass, signedMoney } from './model.js'

const props = defineProps({ summary: { type: Object, required: true }, visible: Boolean, collapsed: Boolean, compact: Boolean })
const emit = defineEmits(['update:visible', 'update:collapsed'])
const detailsId = useId()
const metrics = computed(() => [
  { key: 'available', label: '大账户实时可用' },
  { key: 'marketValue', label: '持仓市值' },
  { key: 'floatingProfit', label: '浮动盈亏', tone: pnlClass(props.summary.floatingProfit) },
])
</script>

<template>
  <section class="ticket-account-summary" :class="{ 'ticket-account-summary--compact': compact }" aria-label="资产账户概要">
    <div v-if="!compact" class="ticket-account-summary-heading">
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
        <dd><span :class="visible ? metric.tone : undefined">{{ visible ? (metric.key === 'floatingProfit' ? signedMoney(summary[metric.key]) : formatNumber(summary[metric.key], 2)) : '••••••••' }}</span><small v-if="!compact || metric.key === 'available'">CNY</small></dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.ticket-account-summary { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--app-color-border); }
.ticket-account-summary-heading { display: flex; min-height: 36px; align-items: center; gap: 2px; }
.ticket-account-summary-title { color: var(--app-color-text); font-size: 12px; }
.ticket-account-summary-heading button { display: inline-flex; min-width: 36px; min-height: 36px; align-items: center; justify-content: center; gap: 4px; padding: 0 6px; border: 0; border-radius: 3px; background: none; color: var(--app-color-text-secondary); font-size: 12px; }
.ticket-account-summary-heading button:active { background: var(--app-color-control); }
.ticket-account-summary-heading button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.ticket-account-summary-heading .ticket-summary-collapse { min-width: 60px; margin-left: auto; padding-right: var(--app-chevron-inset); }
.ticket-account-summary-heading svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
dl { display: grid; gap: 2px; margin: 0; }
dl > div { display: flex; min-width: 0; min-height: 22px; align-items: baseline; flex-wrap: wrap; gap: 2px 12px; }
dt { flex-shrink: 0; color: var(--app-color-text-secondary); font-size: 12px; line-height: 20px; }
dd { min-width: 0; max-width: 100%; margin: 0 0 0 auto; font-family: var(--app-font-family-numeric); font-size: 14px; line-height: 22px; text-align: right; overflow-wrap: anywhere; }
/* 概要金额使用随项目提供的 Roboto 700 字重。 */
dd > span { font-weight: 700; }
dd small { margin-left: 6px; color: var(--app-color-text-secondary); font-size: 12px; white-space: nowrap; }
/* 首页主金额独占一行，其余指标并排；下单面板的纵向概要保持原样。 */
.ticket-account-summary--compact { --ticket-summary-number-size: clamp(14px, 4.2cqw, 17px); container-type: inline-size; flex-shrink: 0; margin: 14px 12px 0; padding: 12px; border: 0; border-radius: 8px; background: linear-gradient(120deg, #27292c, #222427 52%, #1b1c1e); }
.ticket-account-summary--compact dl { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; }
.ticket-account-summary--compact dl > div { min-height: 0; flex-direction: column; align-items: flex-start; gap: 3px; }
.ticket-account-summary--compact dl > div:first-child { grid-column: 1 / -1; transform: translateY(4px); }
.ticket-account-summary--compact dt { font-size: 11px; line-height: 18px; }
.ticket-account-summary--compact dd { display: flex; align-items: baseline; gap: 3px; margin: 0; font-size: var(--ticket-summary-number-size); text-align: left; }
.ticket-account-summary--compact dl > div:first-child dd { font-size: calc(var(--ticket-summary-number-size) * 2); line-height: 1.2; }
.ticket-account-summary--compact dd > span { min-width: 0; font-weight: 400; white-space: nowrap; }
.ticket-account-summary--compact dl > div:first-child dd > span { font-weight: 700; }
.ticket-account-summary--compact dl > div:not(:first-child) { flex-direction: row; flex-wrap: nowrap; align-items: baseline; gap: 6px; }
.ticket-account-summary--compact dl > div:not(:first-child) dt { flex-shrink: 1; }
.ticket-account-summary--compact dl > div:not(:first-child) dd { flex-shrink: 0; margin-left: auto; }
.ticket-account-summary--compact dd small { align-self: flex-end; transform: translateY(-8px); margin: 0 0 0 5px; padding: 1px 5px; border-radius: 3px; background: color-mix(in srgb, var(--app-color-control) 75%, var(--app-color-text-secondary)); font-size: 10px; line-height: 14px; }
/* 窄屏保留完整金额，主金额仍为其余金额字号的两倍。 */
@container (max-width: 340px) {
  .ticket-account-summary--compact dl { column-gap: 12px; }
  .ticket-account-summary--compact dd { --ticket-summary-number-size: 13px; }
}
</style>
