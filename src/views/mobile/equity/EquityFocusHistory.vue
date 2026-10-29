<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { accountLabel, formatNumber, price } from './model.js'
import { buildEquityHistory, equityHistoryCsv } from './equityHistory.js'

const props = defineProps({ show: Boolean, kind: { type: String, default: 'orders' }, record: Object })
const emit = defineEmits(['update:show', 'closed'])
const page = ref(1), refreshKey = ref(0), feedback = ref(''), closeButton = ref(null)
const records = computed(() => { refreshKey.value; return buildEquityHistory(props.record, props.kind) })
const pageSize = 10
const pageCount = computed(() => Math.max(1, Math.ceil(records.value.length / pageSize)))
const pagedRecords = computed(() => records.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const recordLabel = computed(() => ({ positions: '持仓', orders: '订单', trades: '成交' }[props.kind] || '订单'))
watch([() => props.show, () => props.record?.id], () => { page.value = 1; feedback.value = '' })
watch(pageCount, count => { page.value = Math.min(page.value, count) })
const close = () => emit('update:show', false)
function refreshHistory() { page.value = 1; refreshKey.value += 1; feedback.value = '历史记录已刷新' }
function exportHistory() {
  const url = URL.createObjectURL(new Blob([equityHistoryCsv(records.value)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.record?.orderNo || props.record?.code || recordLabel.value}-历史记录.csv`
  link.click()
  URL.revokeObjectURL(url)
  feedback.value = '历史记录已导出'
}
function handleKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
  const target = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1) : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null
  if (target) { event.preventDefault(); target.focus() }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round class="equity-filter-sheet focus-history-sheet" overlay-class="equity-sheet-overlay" :duration=".2" :aria-label="`${recordLabel}历史记录`" aria-modal="true" @update:show="emit('update:show', $event)" @opened="nextTick(() => closeButton?.focus())" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="sheet-heading"><h2>{{ recordLabel }}历史</h2><EquitySheetClose ref="closeButton" aria-label="关闭历史记录" @click="close" /></header>
    <section v-if="record" class="focus-history-context">
      <div class="focus-history-symbol"><strong>{{ record.name }}</strong><span class="app-numeric">{{ record.code }}.{{ record.market }}</span><span v-if="record.side" :class="record.side === 'buy' ? 'equity-positive' : 'equity-negative'">{{ record.side === 'buy' ? '买入' : '卖出' }} · {{ record.openClose === '平' ? '平仓' : '开仓' }}</span></div>
      <dl><div><dt>下单账户</dt><dd>{{ accountLabel(record.account) }}</dd></div><div><dt>订单类型 / 算法</dt><dd>{{ record.orderType || '--' }} / {{ record.algorithm || '--' }}</dd></div><div v-if="record.orderNo"><dt>订单编号</dt><dd class="app-numeric">{{ record.orderNo }}</dd></div><div><dt>{{ kind === 'positions' ? '最新价' : '订单价格' }}</dt><dd class="app-numeric">{{ record.price == null ? '市价' : price(record.price, record.market) }}<template v-if="record.price != null"> {{ record.currency || 'CNY' }}</template></dd></div><div><dt>{{ kind === 'positions' ? '持仓数量' : record.inputAmount != null ? '订单金额' : '订单数量' }}</dt><dd class="app-numeric">{{ formatNumber(kind === 'positions' ? record.quantity ?? record.qty : record.inputAmount ?? record.quantity, record.inputAmount != null && kind !== 'positions' ? 2 : 3, record.inputAmount != null && kind !== 'positions') }} {{ record.inputAmount != null && kind !== 'positions' ? record.currency || 'CNY' : '股' }}</dd></div></dl>
    </section>
    <div class="focus-history-tools"><button type="button" aria-label="刷新历史记录" @click="refreshHistory"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.5 7a8 8 0 0 1 13-1L20 8M4 16l1.5 2a8 8 0 0 0 13-1"/></svg><span>刷新</span></button><button type="button" :disabled="!records.length" @click="exportHistory">导出</button></div>
    <p v-if="feedback" role="status" class="focus-history-feedback">{{ feedback }}</p>
    <div class="focus-history-scroll" role="region" aria-label="历史记录表格，可横向滚动" tabindex="0">
      <table class="focus-history-table"><thead><tr><th scope="col">操作人</th><th scope="col">操作时间</th><th scope="col">操作类型</th><th scope="col">操作内容</th></tr></thead><tbody><tr v-for="(item, index) in pagedRecords" :key="`${item.time}-${index}`"><td>{{ item.operator }}</td><td class="app-numeric"><time>{{ item.time }}</time></td><td>{{ item.type }}</td><td>{{ item.content }}</td></tr><tr v-if="!records.length"><td colspan="4" class="focus-history-empty">暂无历史记录</td></tr></tbody></table>
    </div>
    <footer v-if="pageCount > 1" class="focus-history-pagination"><van-pagination v-model="page" :page-count="pageCount" mode="simple" prev-text="上一页" next-text="下一页" class="equity-pagination" aria-label="历史记录分页" /></footer>
  </van-popup>
</template>

<style scoped>
.focus-history-sheet { height: min(680px, calc(100% - 59px)); color: var(--app-color-text); }
.focus-history-context { flex-shrink: 0; padding: 4px 16px 16px; border-bottom: 1px solid var(--app-color-border); }
.focus-history-symbol { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
.focus-history-symbol strong { font-size: 17px; font-weight: 600; }
.focus-history-symbol > span { color: var(--app-color-text-secondary); font-size: 12px; }
.focus-history-symbol > .equity-positive { color: var(--app-color-rise); }
.focus-history-symbol > .equity-negative { color: var(--app-color-fall); }
.focus-history-context dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 16px 0 0; font-size: 12px; }
.focus-history-context dt { margin-bottom: 4px; color: var(--app-color-text-secondary); }
.focus-history-context dd { margin: 0; overflow-wrap: anywhere; line-height: 18px; }
.focus-history-tools { display: flex; min-height: 52px; flex-shrink: 0; align-items: center; justify-content: flex-end; gap: 6px; padding: 4px 12px 4px 16px; }
.focus-history-tools button { display: inline-flex; min-width: 36px; min-height: 44px; align-items: center; justify-content: center; gap: 4px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--app-color-text); font-size: 12px; }
.focus-history-tools button:disabled { color: var(--app-color-text-secondary); opacity: .45; }
.focus-history-tools button:enabled:active { background: var(--app-color-control); }
.focus-history-tools svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.focus-history-feedback { margin: 0; padding: 0 16px 8px; color: var(--app-color-accent); font-size: 12px; }
.focus-history-scroll { min-height: 0; flex: 1; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--app-color-frame) transparent; }
.focus-history-table { width: 100%; min-width: 600px; border-collapse: separate; border-spacing: 0; font-size: 12px; line-height: 18px; text-align: left; }
.focus-history-table th { position: sticky; top: 0; z-index: 1; height: 40px; background: var(--app-color-control); color: var(--app-color-text-secondary); font-weight: 400; }
.focus-history-table th, .focus-history-table td { padding: 10px 16px; border-bottom: 1px solid var(--app-color-border); vertical-align: top; }
.focus-history-table th:nth-child(1) { width: 84px; }
.focus-history-table th:nth-child(2) { width: 150px; }
.focus-history-table th:nth-child(3) { width: 88px; }
.focus-history-table td:last-child { overflow-wrap: anywhere; }
.focus-history-table time { white-space: nowrap; }
.focus-history-empty { color: var(--app-color-text-secondary); }
.focus-history-pagination { display: flex; min-height: 60px; flex-shrink: 0; align-items: center; gap: 8px; padding: 8px 12px max(8px, env(safe-area-inset-bottom)); border-top: 1px solid var(--app-color-border); font-size: 12px; }
.focus-history-sheet :is(button, [tabindex]):focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
@media (max-height: 600px) { .focus-history-context dl { gap: 6px 12px; margin-top: 8px; } .focus-history-context { padding-bottom: 8px; } }
</style>
