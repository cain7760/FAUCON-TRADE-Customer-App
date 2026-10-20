<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { accountLabel, activityText, formatNumber, orderPrice, orderQuantity, sideLabel } from './model.js'
import { remainingQuantity } from './orderActions.js'

const props = defineProps({ show: Boolean, context: { type: Object, required: true }, result: String, error: String })
const emit = defineEmits(['update:show', 'confirm', 'closed'])
const closeButton = ref(null), note = ref('')
const row = computed(() => props.context.record)
const title = computed(() => props.result ? '操作完成' : ({ cancel: '确认撤单', convert: '转手工单', history: '订单历史' }[props.context.action]))
watch(() => props.show, value => { if (value) note.value = row.value.orderRemark || '' }, { immediate: true })
const close = () => emit('update:show', false)
function handleKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), textarea')].filter(element => element.getClientRects().length)
  const target = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1) : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null
  if (target) { event.preventDefault(); target.focus() }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round class="equity-filter-sheet equity-order-sheet order-operation-sheet" overlay-class="equity-sheet-overlay" :duration=".2" :aria-label="title" aria-modal="true" @update:show="emit('update:show', $event)" @opened="nextTick(() => closeButton?.focus())" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="order-sheet-heading"><h2>{{ title }}</h2><button ref="closeButton" type="button" class="equity-icon-button" aria-label="关闭订单操作" @click="close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>
    <div class="order-entry-scroll ticket-confirm">
      <h3>{{ row.name }} <small>{{ row.code }}</small></h3>
      <template v-if="result"><p role="status">{{ result }}</p></template>
      <template v-else>
        <dl>
          <div><dt>订单编号</dt><dd class="app-numeric">{{ row.orderNo }}</dd></div>
          <div><dt>下单账户</dt><dd>{{ accountLabel(row.account) }}</dd></div>
          <div><dt>订单状态</dt><dd>{{ row.status }}</dd></div>
          <div><dt>交易方向 / 订单类型</dt><dd>{{ sideLabel(row) }} / {{ row.orderType }}</dd></div>
          <div><dt>订单价格</dt><dd class="app-numeric">{{ orderPrice(row) }}</dd></div>
          <div><dt>订单数量 / 金额</dt><dd class="app-numeric">{{ orderQuantity(row) }}</dd></div>
          <div><dt>已成数量</dt><dd class="app-numeric">{{ formatNumber(row.filledQuantity || 0, 3, false) }} 股</dd></div>
          <div v-if="context.action === 'cancel'"><dt>本次撤回数量</dt><dd class="app-numeric">{{ formatNumber(remainingQuantity(row), 3, false) }} 股</dd></div>
          <div v-if="context.action === 'convert'"><dt>执行算法</dt><dd>{{ row.algorithm || '--' }}</dd></div>
          <div><dt>{{ context.action === 'convert' ? '拒绝原因 / 订单动态' : '订单动态' }}</dt><dd>{{ activityText(row) }}</dd></div>
        </dl>
        <template v-if="context.action === 'history'">
          <h3 class="order-history-title">订单操作记录</h3>
          <ol v-if="row.history?.length" class="order-history"><li v-for="(item, index) in row.history" :key="index"><strong>{{ item.action }}</strong><time class="app-numeric">{{ item.time }}</time><p>{{ item.message }}</p></li></ol>
          <p v-else class="ticket-help">暂无操作记录。</p>
        </template>
        <label v-if="context.action === 'convert'" class="ticket-note"><span class="app-form-label">下单备注 <small>{{ note.length }}/200</small></span><textarea v-model="note" maxlength="200" rows="3" placeholder="请输入备注"></textarea></label>
        <p v-if="context.action !== 'history'" class="ticket-help">{{ context.action === 'cancel' ? '只撤回未成交部分，已成交部分保持不变。' : context.action === 'convert' ? '转换后保留原订单编号、价格、数量及状态，交由交易员处理。' : '' }}</p>
        <p v-if="error" class="ticket-error" role="alert">{{ error }}</p>
      </template>
    </div>
    <footer class="ticket-footer ticket-secondary-actions"><button v-if="!result && context.action !== 'history'" type="button" @click="close">返回</button><button type="button" class="ticket-primary" @click="result || context.action === 'history' ? close() : emit('confirm', { note })">{{ result || context.action === 'history' ? '完成' : context.action === 'cancel' ? '确认撤单' : '确认转手工' }}</button></footer>
  </van-popup>
</template>

<style scoped>
.order-operation-sheet { max-height: min(720px, calc(100% - 60px)); }
.order-history-title { margin-top: 24px; font-size: 14px; }
.order-history { padding: 0; list-style: none; }
.order-history li { padding: 12px 0; border-bottom: 1px solid var(--app-color-border); font-size: 13px; }
.order-history time { display: block; margin-top: 4px; color: var(--app-color-text-secondary); }
.order-history p { margin-bottom: 0; overflow-wrap: anywhere; }
</style>
