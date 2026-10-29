<script setup>
import { computed, ref, watch } from 'vue'
import { accountLabel, formatNumber, listTabs, orderPrice, orderQuantity, pnlClass, price, sideLabel, signedMoney } from './model.js'
import { focusTableColumns, sortFocusRecords } from './focusTableColumns.js'
import EquityOrderStatus from './EquityOrderStatus.vue'

const props = defineProps({ kind: { type: String, required: true }, records: { type: Array, required: true } })
const emit = defineEmits(['open', 'order-change'])
const sortKey = ref('')
const sortDirection = ref('ascending')
const list = computed(() => listTabs.find(item => item.key === props.kind))
const sortColumns = computed(() => focusTableColumns(props.kind))
const sortedRecords = computed(() => sortFocusRecords(props.records, props.kind, sortColumns.value.find(column => column.key === sortKey.value), sortDirection.value))
watch(sortedRecords, rows => emit('order-change', rows.map(row => row.id)), { immediate: true, flush: 'sync' })
watch(() => props.kind, () => { sortKey.value = ''; sortDirection.value = 'ascending' })
const quantity = value => formatNumber(value, 3, false)
const timeLabel = value => value ? String(value).slice(-8) : '--'
const statusClass = row => ({ 'is-alert': ['异常', '拒单'].includes(row.status), 'is-complete': row.status === '全成' })
</script>

<template>
  <section class="focus-records" :aria-label="`${list.label}卡片`">
    <div class="focus-list-tools">
      <slot name="controls"><span class="focus-list-count"><b class="app-numeric">{{ records.length }}</b> 条记录</span></slot>
      <div class="focus-sort-controls">
        <select v-model="sortKey" :aria-label="`${list.label}排序字段`">
          <option value="">默认排序</option>
          <option v-for="column in sortColumns" :key="column.key" :value="column.key">{{ column.title }}</option>
        </select>
        <button type="button" :disabled="!sortKey" :aria-label="sortDirection === 'ascending' ? '升序，点击改为降序' : '降序，点击改为升序'" @click="sortDirection = sortDirection === 'ascending' ? 'descending' : 'ascending'">
          <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ 'is-descending': sortDirection === 'descending' }"><path d="M8 19V5m-4 4 4-4 4 4M15 7h5M15 12h4M15 17h2"/></svg>
        </button>
      </div>
    </div>
    <div class="focus-list-scroll" tabindex="0" :aria-label="`${list.label}，点按记录查看详情`">
      <button v-for="(record, index) in sortedRecords" :key="record.id" type="button" class="focus-record" :aria-label="`查看${record.name}${list.detail}${kind === 'orders' ? ` ${record.orderNo}` : ''}`" @click="$emit('open', { record, index: index + 1, event: $event })">
        <span class="focus-record-heading">
          <span class="focus-record-identity">
            <strong>{{ record.name }}</strong>
            <span class="focus-instrument-meta"><span class="app-numeric">{{ record.code }}.{{ record.market }}</span><span>{{ record.currency }}</span></span>
          </span>
          <span v-if="kind === 'positions'" class="focus-record-highlight">
            <span class="focus-caption">浮动盈亏 · {{ record.currency }}</span>
            <strong class="app-numeric" :class="pnlClass(record.floatingProfit)">{{ signedMoney(record.floatingProfit) }}</strong>
          </span>
          <EquityOrderStatus v-else-if="kind === 'orders'" :status="record.status" />
          <span v-else class="focus-record-highlight">
            <span class="focus-caption">成交金额 · {{ record.currency }}</span>
            <strong class="app-numeric">{{ formatNumber(record.filledAmount) }}</strong>
          </span>
        </span>

        <span v-if="kind === 'positions'" class="focus-position-metrics">
          <span class="focus-metric"><span class="focus-caption">持仓 / 可用（股）</span><span class="app-numeric">{{ quantity(record.qty) }} <span class="focus-secondary">/ {{ quantity(record.available) }}</span></span></span>
          <span class="focus-metric"><span class="focus-caption">均价 / 最新</span><span class="app-numeric">{{ price(record.cost, record.market) }} <span class="focus-secondary">/ <span :class="pnlClass(record.change)">{{ price(record.price, record.market) }}</span></span></span></span>
        </span>
        <template v-else>
          <span class="focus-order-context"><span :class="record.side === 'buy' ? 'equity-positive' : 'equity-negative'">{{ sideLabel(record) }}</span><span>{{ record.type === 'market' ? '市价单' : '限价单' }}</span><span>{{ record.orderType || '--' }}</span></span>
          <span class="focus-trade-metrics">
            <span class="focus-metric"><span class="focus-caption">{{ kind === 'orders' ? '订单价格' : '成交均价' }}</span><span class="app-numeric">{{ kind === 'orders' ? orderPrice(record) : price(record.filledPrice, record.market) }}</span></span>
            <span class="focus-metric"><span class="focus-caption">{{ kind === 'orders' ? '订单数量/金额' : '成交数量（股）' }}</span><span class="app-numeric">{{ kind === 'orders' ? orderQuantity(record) : quantity(record.filledQuantity) }}</span></span>
            <span class="focus-metric"><span class="focus-caption">{{ kind === 'orders' ? '已成（股）' : '执行算法' }}</span><span :class="{ 'app-numeric': kind === 'orders' }">{{ kind === 'orders' ? record.filledQuantity ? quantity(record.filledQuantity) : '--' : record.algorithm || '--' }}</span></span>
          </span>
        </template>

        <span class="focus-record-footer">
          <span v-if="kind === 'positions'">{{ record.direction === '多' ? '做多' : '做空' }}<span class="focus-meta-separator">·</span>{{ accountLabel(record.account) }}</span>
          <span v-else class="app-numeric">{{ timeLabel(kind === 'orders' ? record.orderTime : record.filledTime) }}<span class="focus-meta-separator">·</span>{{ record.currency }}</span>
          <span class="focus-record-more">详情<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span>
        </span>
      </button>
      <p v-if="!records.length" class="focus-list-empty">{{ list.empty }}</p>
      <p v-else class="focus-list-end">已显示全部 {{ records.length }} 条</p>
    </div>
  </section>
</template>

<style scoped>
.focus-records { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; color: var(--app-color-text); }
.focus-list-tools { display: flex; min-height: 44px; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 8px; padding: 0 20px; color: var(--app-color-text-secondary); font-size: 12px; }
.focus-list-count { white-space: nowrap; }
.focus-list-count b { color: var(--app-color-text); font-size: 14px; font-weight: 400; }
.focus-sort-controls { display: flex; min-width: 0; align-items: center; }
.focus-sort-controls select { width: auto; max-width: 120px; min-width: 0; height: 44px; padding: 0 28px 0 8px; border: 0; border-radius: 4px; background-color: transparent; background-position: right 4px center; color: var(--app-color-text-secondary); font: inherit; text-align: right; }
.focus-sort-controls option { background: var(--app-color-surface); color: var(--app-color-text); }
.focus-sort-controls button { display: grid; width: 44px; height: 44px; place-items: center; padding: 0; border: 0; border-radius: 4px; background: none; color: var(--app-color-accent); }
.focus-sort-controls button:disabled { opacity: .4; cursor: not-allowed; }
.focus-sort-controls svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.focus-sort-controls .is-descending { transform: scaleY(-1); }
.focus-list-scroll { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 12px; overflow: auto; overscroll-behavior: contain; padding: 4px 16px 16px; scroll-padding-block: 12px; scrollbar-width: thin; scrollbar-color: var(--app-color-frame) transparent; }
.focus-record { display: block; width: 100%; flex-shrink: 0; padding: 16px; border: 1px solid var(--app-color-border); border-radius: 12px; background: var(--app-color-card); color: inherit; font: inherit; text-align: left; cursor: pointer; touch-action: manipulation; transition: background-color 160ms ease-out; }
.focus-record:active { background: var(--app-color-control); }
.focus-record:focus-visible, .focus-sort-controls :is(button, select):focus-visible, .focus-list-scroll:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.focus-record-heading { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 12px; }
.focus-record-identity { min-width: 0; flex: 1; }
.focus-record-identity > strong { display: block; font-size: 16px; font-weight: 600; line-height: 24px; overflow-wrap: anywhere; }
.focus-instrument-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; color: var(--app-color-text-secondary); font-size: 12px; line-height: 18px; }
.focus-record-highlight { min-width: 0; max-width: 55%; text-align: right; }
.focus-record-highlight > strong { display: block; margin-top: 2px; font-size: 20px; font-weight: 400; line-height: 24px; overflow-wrap: anywhere; }
.focus-caption { display: block; color: var(--app-color-text-secondary); font-size: 12px; font-weight: 400; line-height: 18px; }
.focus-position-metrics, .focus-trade-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin-top: 14px; }
.focus-trade-metrics { grid-template-columns: .9fr 1.3fr 1fr; margin-top: 12px; }
.focus-metric { min-width: 0; font-size: 14px; line-height: 20px; }
.focus-metric > span:last-child { display: block; margin-top: 4px; overflow-wrap: anywhere; }
.focus-position-metrics .focus-metric:last-child, .focus-trade-metrics .focus-metric:last-child { text-align: right; }
.focus-trade-metrics .focus-metric:nth-child(2) { text-align: center; }
.focus-secondary { color: var(--app-color-text-secondary); }
.focus-order-context { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--app-color-text-secondary); font-size: 12px; line-height: 18px; }
.focus-status { display: inline-flex; flex-shrink: 0; align-items: center; min-height: 24px; padding: 2px 7px; border-radius: 4px; background: var(--app-color-accent-soft); color: var(--app-color-accent); font-size: 12px; line-height: 18px; }
.focus-status.is-alert { background: var(--app-color-rise-soft); color: var(--app-color-rise); }
.focus-status.is-complete { background: var(--app-color-fall-soft); color: var(--app-color-fall); }
.focus-record-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--app-color-border); color: var(--app-color-text-secondary); font-size: 12px; line-height: 18px; }
.focus-record-footer > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.focus-meta-separator { margin: 0 6px; }
.focus-record-more { display: inline-flex; flex-shrink: 0; align-items: center; gap: 2px; }
.focus-record-more svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.focus-list-end, .focus-list-empty { margin: 0; padding: 20px 0; color: var(--app-color-text-secondary); font-size: 12px; line-height: 20px; text-align: center; }
@media (max-width: 360px) {
  .focus-list-tools { padding-inline: 16px; }
  .focus-list-scroll { padding-inline: 16px; }
  .focus-record { padding: 12px; }
  .focus-record-heading { gap: 8px; }
  .focus-position-metrics, .focus-trade-metrics { column-gap: 8px; }
}
</style>
