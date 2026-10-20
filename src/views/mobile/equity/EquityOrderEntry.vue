<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { showSuccessToast } from 'vant'
import { accounts, demoRecords, orderInstruments } from './fixtures.js'
import { accountLabel, formatNumber } from './model.js'
import { algorithmOptions, applyBookPrice, canPreviewOrder, changeOrderMode, changeOrderType, defaultOrderAlgorithm, demoOrderCash, largeOrderAmount, orderError, orderEstimates, resetOrderSize, validPov } from './orderModel.js'
import { amendmentDraft, amendmentError, amendmentEstimate, amendmentPayload, remainingQuantity } from './orderActions.js'
import { orderAccountOverview } from './accountOverview.js'
import EquitySymbolPicker from './EquitySymbolPicker.vue'
import { canUseMarketOrder, normalizeOrderType, orderTypeError } from './orderMarketRules.js'
import EquityOrderBook from './EquityOrderBook.vue'
import EquityAccountPicker from './EquityAccountPicker.vue'
import EquityAccountSummary from './EquityAccountSummary.vue'
import './order-entry.css'

const props = defineProps({ show: Boolean, context: { type: Object, required: true } })
const emit = defineEmits(['update:show', 'closed', 'amend', 'order'])
const closeButton = ref(null), heading = ref(null), symbolPicker = ref(null), quantityInput = ref(null), accountTrigger = ref(null)
const page = ref('form'), error = ref(''), snapshot = ref(null)
// 视图偏好不随下单子页面或账户切换重置，避免隐藏后的资金意外重新显示。
const assetsVisible = ref(true), assetsCollapsed = ref(false)
const accountId = ref(accounts[0].id), symbolCode = ref('000001'), manualSymbol = ref(null)
const draft = reactive({ execution: 'lowTouch', type: 'limit', price: '', mode: 'quantity', value: '', unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: 'DMA', pov: { hours: 1, minutes: 0, participation: 10 }, note: '' })
const algorithmDraft = reactive({ value: 'DMA', hours: 1, minutes: 0, participation: 10 })
const customDraft = reactive({ name: '', code: '', market: 'A' })
const instruments = orderInstruments
const isLocked = computed(() => props.context.action !== 'new')
const isClose = computed(() => props.context.action === 'close')
const isAmend = computed(() => props.context.action === 'amend')
const doneMessage = ref('')
const title = computed(() => ({ accounts: '选择下单账户', symbols: '标的搜索', algorithm: '执行算法', custom: '手动新增标的', confirm: isAmend.value ? '确认改单' : snapshot.value ? `确认${snapshot.value.side === 'buy' ? '买入' : '卖出'} ${number(snapshot.value.quantity)} 股吗？` : '确认订单', done: '确认完成' }[page.value] || (isAmend.value ? '改单' : isClose.value ? '平仓' : isLocked.value ? '追单' : '下单')))
const symbol = computed(() => manualSymbol.value || instruments.find(row => row.code === symbolCode.value) || (isLocked.value ? props.context.record : null))
const symbolCurrency = computed(() => symbol.value?.currency || (symbol.value?.market === 'HK' ? 'HKD' : symbol.value?.market === 'US' ? 'USD' : 'CNY'))
const priceTypeOptions = computed(() => canUseMarketOrder(symbol.value) ? [['limit', '限价'], ['market', '市价']] : [['limit', '限价']])
const position = computed(() => demoRecords.positions.find(row => row.account === accountId.value && row.code === symbolCode.value))
const estimate = computed(() => isAmend.value ? amendmentEstimate(draft, props.context.record, symbol.value, demoOrderCash[accountId.value]) : orderEstimates(draft, symbol.value, demoOrderCash[accountId.value], position.value?.available))
const positionCodes = computed(() => demoRecords.positions.filter(row => row.account === accountId.value && row.qty > 0).map(row => row.code))
const accountOverview = computed(() => orderAccountOverview(accountId.value, demoRecords.positions))
const algorithmLabel = computed(() => algorithmOptions.find(option => option.value === draft.algorithm)?.label)
const usesAmount = computed(() => draft.mode === 'amount')
// 金额始终以元保存，单位切换只转换输入框的显示值。
const displayValue = computed({
  get: () => draft.value === '' ? '' : Number(draft.value) / (usesAmount.value && draft.amountUnit === 'wan' ? 10000 : 1),
  set: value => { draft.value = value === '' ? '' : Number(value) * (usesAmount.value && draft.amountUnit === 'wan' ? 10000 : 1) },
})
const isPercent = computed(() => draft.mode === 'percentage')
const isManual = computed(() => draft.execution === 'highTouch')
const lotError = computed(() => !usesAmount.value && !isPercent.value && Number(draft.value) > 0 && estimate.value.buy % estimate.value.lot !== 0)
const showBuy = computed(() => isAmend.value ? props.context.record.side === 'buy' : !isLocked.value || !isClose.value)
const showSell = computed(() => isAmend.value ? props.context.record.side === 'sell' : !isLocked.value || isClose.value)
const number = value => formatNumber(value, 0, false)
const money = value => formatNumber(value, 2)
const close = () => emit('update:show', false)
let formReturnFocus = null
function resetSize() { resetOrderSize(draft); error.value = '' }
function initialize() {
  const record = props.context.record
  accountId.value = record?.account || accounts[0].id
  symbolCode.value = record?.code || instruments[0].code
  manualSymbol.value = null
  Object.assign(draft, { execution: 'lowTouch', type: 'limit', price: symbol.value?.price || '', mode: 'quantity', value: '', unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: defaultOrderAlgorithm(symbol.value?.market), pov: { hours: 1, minutes: 0, participation: 10 }, note: '' })
  if (isAmend.value) Object.assign(draft, amendmentDraft(record))
  page.value = 'form'; snapshot.value = null; error.value = ''; doneMessage.value = ''
}
watch(() => props.show, show => { if (show) initialize() }, { immediate: true })
watch(draft, () => { error.value = '' }, { deep: true })
watch([symbol, () => draft.type], () => { draft.type = normalizeOrderType(draft.type, symbol.value) }, { immediate: true })
watch(() => estimate.value.sell, quantity => {
  if (isClose.value && !isPercent.value) draft.fraction = estimate.value.maxSell > 0 ? Math.min(100, Math.round(quantity / estimate.value.maxSell * 100)) : 0
})
function navigate(next, event) {
  formReturnFocus = event?.currentTarget || formReturnFocus
  error.value = ''
  if (next === 'algorithm') Object.assign(algorithmDraft, { value: draft.algorithm, ...draft.pov })
  page.value = next
  nextTick(() => next === 'symbols' ? symbolPicker.value?.focusSearch() : heading.value?.focus())
}
function back() {
  if (page.value === 'done') { close(); return }
  const wasAccountPicker = page.value === 'accounts'
  page.value = 'form'; error.value = ''
  nextTick(() => (wasAccountPicker ? accountTrigger.value : formReturnFocus?.isConnected ? formReturnFocus : closeButton.value)?.focus())
}
function updatePopup(show) {
  if (!show && page.value === 'accounts') back()
  else emit('update:show', show)
}
function selectSymbol(row) {
  symbolCode.value = row.code; manualSymbol.value = row.isManual ? row : null
  if (row.isManual) { draft.mode = 'quantity'; draft.unit = 'shares' }
  draft.price = row.price ?? ''; draft.algorithm = defaultOrderAlgorithm(row.market); draft.note = ''; resetSize(); back()
}
function clearSymbol() { symbolCode.value = ''; manualSymbol.value = null; draft.price = ''; draft.note = ''; resetSize() }
function changeAccount(id) { if (id !== accountId.value) { accountId.value = id; draft.note = ''; resetSize() }; back() }
function changeExecution(value) {
  if (draft.execution === value) return
  draft.execution = value
  if (manualSymbol.value) selectSymbol(instruments[0])
  draft.price = symbol.value?.price ?? ''
  draft.note = ''; resetSize()
}
function setType(value) { changeOrderType(draft, value, symbol.value) }
function setMode(value) { changeOrderMode(draft, value) }
function stepPrice(direction) { draft.price = Number(Math.max(0, (Number(draft.price) || 0) + direction * .01).toFixed(2)) }
function selectFraction(value) { draft.mode = 'percentage'; draft.fraction = Number(value); error.value = '' }
function normalizeInput(field, precision) { if (draft[field] !== '' && Number.isFinite(Number(draft[field]))) draft[field] = Number(Number(draft[field]).toFixed(precision)) }
function normalizeSize() {
  if (displayValue.value !== '' && Number.isFinite(Number(displayValue.value))) displayValue.value = Number(Number(displayValue.value).toFixed(usesAmount.value ? 2 : 0))
}
function editPercentage() { draft.mode = 'quantity'; draft.unit = 'shares'; draft.value = 0; draft.fraction = 0; nextTick(() => quantityInput.value?.focus()) }
// Vant 提供 Tab/tabpanel 语义；补齐横向 Tab 的键盘选择与焦点同步。
function handleAlgorithmKeydown(event) {
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')]
  const index = tabs.indexOf(event.target.closest('[role="tab"]'))
  if (index < 0) return
  const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key]
  if (next === undefined) return
  event.preventDefault()
  algorithmDraft.value = algorithmOptions[next].value
  nextTick(() => tabs[next]?.focus())
}
function applyAlgorithm() {
  if (algorithmDraft.value === 'POV' && !validPov(algorithmDraft)) return
  draft.algorithm = algorithmDraft.value
  draft.pov = { hours: Number(algorithmDraft.hours), minutes: Number(algorithmDraft.minutes), participation: Number(algorithmDraft.participation) }
  back()
}
function addManualSymbol() {
  if (!customDraft.name.trim() || !customDraft.code.trim()) { error.value = '请填写标的名称和代码'; return }
  selectSymbol({ name: customDraft.name.trim(), code: customDraft.code.trim(), market: customDraft.market, isManual: true })
}
function preview(side, event) {
  if (isAmend.value) {
    const row = props.context.record
    const message = amendmentError(draft, row, symbol.value, estimate.value)
    if (message) { error.value = message; return }
    const amendment = { ...amendmentPayload(draft, row, estimate.value), referencePrice: estimate.value.price }
    snapshot.value = { side: row.side, symbol: { ...symbol.value }, account: row.account, execution: draft.execution, type: draft.type,
      price: estimate.value.price, quantity: amendment.quantity, amount: estimate.value[row.side] * Math.round(estimate.value.price * 100) / 100,
      algorithm: algorithmLabel.value, pov: { ...draft.pov }, inputAmount: amendment.inputAmount, note: draft.note.trim(),
      remaining: estimate.value[row.side], filled: Number(row.filledQuantity || 0), amendment }
    navigate('confirm', event); return
  }
  if (isLocked.value && side !== (isClose.value ? 'sell' : 'buy')) return
  const message = orderError(draft, symbol.value, estimate.value, side)
  if (message) { error.value = message; return }
  snapshot.value = { side, symbol: { ...symbol.value }, account: accountId.value, execution: draft.execution, type: draft.type, price: estimate.value.price, quantity: estimate.value[side], amount: side === 'buy' ? estimate.value.buyAmount : estimate.value.sellAmount, algorithm: algorithmLabel.value, algorithmCode: draft.algorithm, pov: { ...draft.pov }, inputAmount: usesAmount.value ? estimate.value.inputAmount : null, note: draft.note.trim(), openClose: isClose.value ? '平' : '开' }
  navigate('confirm', event)
}
function confirmDemo() {
  if (!snapshot.value) return
  const typeError = orderTypeError(snapshot.value.type, snapshot.value.symbol)
  if (typeError) { error.value = typeError; return }
  if (isAmend.value) {
    emit('amend', snapshot.value.amendment, result => {
      if (result.error) { error.value = result.error; return }
      showSuccessToast('改单提交成功')
      close()
    })
    return
  }
  emit('order', snapshot.value)
  resetSize(); draft.note = ''
  doneMessage.value = '订单已加入所有订单，状态为待报。'
  page.value = 'done'; nextTick(() => heading.value?.focus())
}
function handleKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); page.value === 'form' ? close() : back(); return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
  if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === heading.value)) { event.preventDefault(); controls.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round transition-appear class="equity-filter-sheet equity-order-sheet" :class="{ 'equity-symbol-sheet': page === 'symbols', 'equity-account-sheet': page === 'accounts' }" overlay-class="equity-sheet-overlay" :duration=".2" :aria-label="title" aria-modal="true" @update:show="updatePopup" @opened="closeButton?.focus()" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header v-if="page !== 'symbols'" class="order-sheet-heading">
      <button v-if="!['form', 'accounts'].includes(page)" type="button" class="equity-icon-button" aria-label="返回下单面板" @click="back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
      <h2 ref="heading" tabindex="-1">{{ title }}</h2>
      <button ref="closeButton" type="button" class="equity-icon-button" :aria-label="page === 'accounts' ? '关闭账户选择' : '关闭下单面板'" @click="page === 'accounts' ? back() : close()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
    </header>
    <EquitySymbolPicker v-show="page === 'symbols'" ref="symbolPicker" :active="page === 'symbols'" :instruments="instruments" :position-codes="positionCodes" :selected-code="symbolCode" :allow-manual="isManual" @select="selectSymbol" @close="close" @manual="value => { customDraft.name = value; customDraft.code = ''; navigate('custom') }" />
    <template v-if="page === 'form'">
      <div class="order-entry-scroll">
        <div v-if="!isAmend" class="ticket-segment ticket-execution" role="group" aria-label="订单类型"><button v-for="item in [['lowTouch', '系统单'], ['highTouch', '手工单']]" :key="item[0]" type="button" :aria-pressed="draft.execution === item[0]" @click="changeExecution(item[0])">{{ item[1] }}</button></div>
        <div v-else class="ticket-amend-original"><strong>{{ context.record.orderType }} · {{ context.record.side === 'buy' ? '买入' : '卖出' }}{{ context.record.openClose === '开' ? '开仓' : '平仓' }}</strong><span class="app-numeric">{{ context.record.orderNo }}</span><span>原数量 {{ number(context.record.quantity) }} 股 · 已成 {{ number(context.record.filledQuantity || 0) }} 股</span><span>未成交 {{ number(remainingQuantity(context.record)) }} 股；下方仅修改未成交部分。</span></div>
        <div class="ticket-account"><span class="app-form-label">下单账户</span><button ref="accountTrigger" type="button" :disabled="isLocked" :aria-label="`下单账户 ${accountLabel(accountId)}`" @click="navigate('accounts', $event)"><span>{{ accountLabel(accountId) }}</span><span class="app-chevron" aria-hidden="true"></span></button></div>
        <section class="ticket-field">
          <div class="ticket-caption"><span class="app-form-label">下单标的</span><span class="ticket-symbol-tags"><b>{{ symbolCurrency }}</b><span>40% IA</span></span></div>
          <div class="ticket-symbol-control"><button type="button" :disabled="isLocked" :aria-label="symbol ? `下单标的 ${symbol.name} ${symbol.code}` : '选择下单标的'" @click="navigate('symbols', $event)"><template v-if="symbol"><strong>{{ symbol.name }}</strong><span class="app-numeric">（{{ symbol.code }}）</span></template><span v-else>搜索标的名称 / 代码</span></button><button v-if="symbol && !isLocked" type="button" class="equity-icon-button" aria-label="清空下单标的" @click="clearSymbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
        </section>
        <section class="ticket-field">
          <div class="ticket-caption"><label class="app-form-label" for="mobile-order-price">订单价格</label><div class="ticket-segment" role="group" aria-label="价格类型"><button v-for="item in priceTypeOptions" :key="item[0]" type="button" :aria-pressed="draft.type === item[0]" @click="setType(item[0])">{{ item[1] }}</button></div></div>
          <div v-if="draft.type === 'limit'" class="ticket-number-control ticket-price-control" :class="{ 'has-error': draft.price !== '' && !(draft.price > 0) }"><button type="button" aria-label="减少订单价格" :disabled="!symbol || !(draft.price > 0)" @click="stepPrice(-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><input id="mobile-order-price" v-model="draft.price" :disabled="!symbol" type="number" inputmode="decimal" min="0" step="0.01" placeholder="请输入" :aria-describedby="draft.price !== '' && !(draft.price > 0) ? 'ticket-price-error' : undefined" @blur="normalizeInput('price', 2)"><button type="button" aria-label="增加订单价格" :disabled="!symbol" @click="stepPrice(1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button></div>
          <div v-else class="ticket-market-price">以市场价格成交</div><p v-if="draft.type === 'limit' && draft.price !== '' && !(draft.price > 0)" id="ticket-price-error" class="ticket-error">订单价格须大于 0</p>
        </section>
        <section class="ticket-field">
          <div class="ticket-caption"><label class="app-form-label" :for="isPercent ? 'mobile-order-percent' : 'mobile-order-quantity'">{{ isAmend ? (usesAmount ? '未成交部分金额' : '未成交部分数量') : usesAmount ? '订单金额' : '订单数量' }}</label><span v-if="!usesAmount && symbol && !symbol.isManual" class="ticket-lot app-numeric">{{ estimate.lot }}股/手</span><div class="ticket-segment" role="group" aria-label="下单单位类型"><button type="button" :aria-pressed="!usesAmount" @click="setMode('quantity')">数量</button><button v-if="draft.type === 'limit'" type="button" :aria-pressed="usesAmount" @click="setMode('amount')">金额</button></div></div>
          <div v-if="isPercent" class="ticket-percentage-control"><input id="mobile-order-percent" :value="`${draft.fraction}%`" readonly aria-label="订单数量百分比，点击手动输入" @focus="editPercentage"><span>{{ isAmend ? (context.record.side === 'sell' ? '最大可卖' : '最大可买') : isLocked ? (isClose ? '最大可卖' : '最大可买') : '最大可买 / 可卖' }}</span></div>
          <div v-else class="ticket-number-control ticket-quantity-control" :class="{ 'has-error': lotError }"><input id="mobile-order-quantity" ref="quantityInput" v-model="displayValue" :disabled="!symbol" type="number" :inputmode="usesAmount ? 'decimal' : 'numeric'" min="0" :step="usesAmount ? '.01' : draft.unit === 'wan' ? '1' : estimate.lot" placeholder="请输入" :aria-label="usesAmount ? '订单金额' : '订单数量'" @blur="normalizeSize"><select v-if="usesAmount" v-model="draft.amountUnit" aria-label="金额单位"><option value="yuan">元</option><option value="wan">万元</option></select><select v-else v-model="draft.unit" :class="{ 'is-wan-unit': draft.unit === 'wan' }" aria-label="数量单位" @change="resetSize"><option value="shares">股</option><option value="wan">万股</option></select></div>
          <p v-if="lotError" class="ticket-error" role="alert">订单数量须为 {{ estimate.lot }} 股的整数倍</p><p v-if="usesAmount && estimate.inputAmount > largeOrderAmount" class="ticket-warning">大额订单，请核对委托金额</p>
        </section>
        <div class="ticket-algorithm-row"><span class="app-form-label">算法</span><button type="button" :aria-label="`配置执行算法 ${algorithmLabel}`" @click="navigate('algorithm', $event)"><b class="app-numeric">{{ algorithmLabel }}</b><span v-if="draft.algorithm === 'POV'" class="app-numeric">{{ draft.pov.hours }}时{{ draft.pov.minutes }}分 · {{ draft.pov.participation }}%</span><span class="app-chevron" aria-hidden="true"></span></button></div>
        <div v-if="!isManual" class="ticket-fraction-slider"><input type="range" aria-label="下单比例" :style="{ '--ticket-fraction': `${draft.fraction}%` }" :value="draft.fraction" min="0" max="100" step="1" @input="selectFraction($event.target.value)"><div class="ticket-fractions" role="group" aria-label="快捷下单比例"><button v-for="value in [0, 25, 50, 75, 100]" :key="value" type="button" :aria-pressed="isPercent && draft.fraction === value" @click="selectFraction(value)">{{ value }}%</button></div></div>
        <dl v-if="!isManual" class="ticket-estimates" aria-label="订单预估"><div v-if="showBuy"><dt>最大可买</dt><dd>{{ number(estimate.maxBuy) }} 股</dd></div><div v-if="showSell"><dt>最大可卖</dt><dd>{{ number(estimate.maxSell) }} 股</dd></div><div v-if="showBuy"><dt>买入预估(股)</dt><dd>{{ estimate.buy > 0 ? number(estimate.buy) : '--' }}</dd></div><div v-if="showSell"><dt>卖出预估(股)</dt><dd>{{ estimate.sell > 0 ? number(estimate.sell) : '--' }}</dd></div><div v-if="showBuy"><dt>买入金额(CNY)</dt><dd>{{ estimate.buyAmount > 0 ? money(estimate.buyAmount) : '--' }}</dd></div><div v-if="showSell"><dt>预估卖出金额(CNY)</dt><dd>{{ estimate.sellAmount > 0 ? money(estimate.sellAmount) : '--' }}</dd></div></dl>
        <label v-if="isManual" class="ticket-note"><span class="app-form-label">备注 <small>{{ draft.note.length }}/200</small></span><textarea v-model="draft.note" maxlength="200" rows="3" placeholder="请输入备注"></textarea></label>
        <EquityOrderBook :symbol="symbol" @quote="applyBookPrice(draft, $event)" />
      </div>
<footer class="ticket-footer"><p v-if="error" class="ticket-error" role="alert">{{ error }}</p><div v-if="isAmend" class="ticket-secondary-actions"><button type="button" class="ticket-primary" @click="preview(context.record.side, $event)">预览改单</button></div><div v-else class="ticket-trade-buttons"><button v-if="showBuy" type="button" class="ticket-buy" :disabled="!canPreviewOrder(draft, symbol, estimate, 'buy')" @click="preview('buy', $event)">买入</button><button v-if="showSell" type="button" class="ticket-sell" :disabled="!canPreviewOrder(draft, symbol, estimate, 'sell')" @click="preview('sell', $event)">卖出</button></div><EquityAccountSummary v-model:visible="assetsVisible" v-model:collapsed="assetsCollapsed" :summary="accountOverview" /></footer>
    </template>
    <EquityAccountPicker v-else-if="page === 'accounts'" :accounts="accounts" :selected-id="accountId" @select="changeAccount" />
    <template v-else-if="page === 'algorithm'">
      <div class="order-entry-scroll ticket-settings">
        <van-tabs v-model:active="algorithmDraft.value" type="card" :ellipsis="false" :duration="0" class="ticket-algorithm-tabs" @keydown="handleAlgorithmKeydown">
          <van-tab v-for="option in algorithmOptions" :key="option.value" :name="option.value" :title="option.label">
            <div v-if="option.value === 'POV'" class="ticket-algorithm-params"><label class="app-form-label">运行时间</label><div class="ticket-duration"><label><select v-model="algorithmDraft.hours" aria-label="POV运行小时"><option v-for="hour in 24" :key="hour" :value="hour - 1">{{ String(hour - 1).padStart(2, '0') }}</option></select><span>时</span></label><label><select v-model="algorithmDraft.minutes" aria-label="POV运行分钟"><option v-for="minute in 60" :key="minute" :value="minute - 1">{{ String(minute - 1).padStart(2, '0') }}</option></select><span>分</span></label></div><label class="app-form-label" for="mobile-pov-participation">市场成交占比</label><div class="ticket-participation"><input id="mobile-pov-participation" v-model="algorithmDraft.participation" type="number" inputmode="numeric" min="1" max="25" step="1"><span>%</span></div><p class="ticket-help">市场成交占比不超过 25%，运行时间不能为 0。</p><p v-if="!validPov(algorithmDraft)" class="ticket-error" role="alert">请填写有效的运行时间和成交占比</p></div>
          </van-tab>
        </van-tabs>
      </div>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="back">取消</button><button type="button" class="ticket-primary" :disabled="algorithmDraft.value === 'POV' && !validPov(algorithmDraft)" @click="applyAlgorithm">确认配置</button></footer>
    </template>
    <template v-else-if="page === 'custom'">
      <div class="order-entry-scroll ticket-settings"><label class="app-form-label" for="mobile-custom-name">标的名称</label><input id="mobile-custom-name" v-model="customDraft.name" maxlength="40" placeholder="请输入标的名称"><label class="app-form-label" for="mobile-custom-code">标的代码</label><input id="mobile-custom-code" v-model="customDraft.code" maxlength="24" placeholder="请输入标的代码"><label class="app-form-label" for="mobile-custom-market">所属市场</label><select id="mobile-custom-market" v-model="customDraft.market"><option value="A">A股</option><option value="HK">港股</option><option value="US">美股</option></select><p v-if="error" class="ticket-error" role="alert">{{ error }}</p></div>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="navigate('symbols')">取消</button><button type="button" class="ticket-primary" @click="addManualSymbol">新增标的</button></footer>
    </template>
    <template v-else-if="page === 'confirm' && snapshot">
      <div class="order-entry-scroll ticket-confirm"><h3><span :class="snapshot.side === 'buy' ? 'equity-positive' : 'equity-negative'">{{ snapshot.side === 'buy' ? '买入' : '卖出' }}</span> {{ snapshot.symbol.name }} <small>{{ snapshot.symbol.code }}</small></h3><dl><div><dt>订单价格 ({{ symbolCurrency }})</dt><dd>{{ snapshot.type === 'limit' ? money(snapshot.price) : '市价' }}</dd></div><div><dt>{{ isAmend ? '改后订单总数量 (股)' : '订单数量 (股)' }}</dt><dd>{{ number(snapshot.quantity) }}</dd></div><div><dt>{{ isAmend ? '未成交部分预估金额 (CNY)' : '预估金额 (CNY)' }}</dt><dd>{{ snapshot.price > 0 ? money(snapshot.amount) : '--' }}</dd></div><div><dt>下单账户</dt><dd>{{ accountLabel(snapshot.account) }}</dd></div><div><dt>订单类型</dt><dd>{{ snapshot.execution === 'highTouch' ? '手工单' : '系统单' }}</dd></div><div><dt>执行算法</dt><dd>{{ snapshot.algorithm }}</dd></div><div><dt>订单方式</dt><dd>{{ snapshot.type === 'limit' ? '限价单' : '市价单' }}</dd></div><template v-if="snapshot.algorithm === 'POV'"><div><dt>运行时间</dt><dd>{{ snapshot.pov.hours }} 时 {{ snapshot.pov.minutes }} 分</dd></div><div><dt>市场成交占比</dt><dd>{{ snapshot.pov.participation }}%</dd></div></template><div v-if="snapshot.inputAmount !== null"><dt>订单金额 (CNY)</dt><dd>{{ money(snapshot.inputAmount) }}</dd></div><div v-if="snapshot.note"><dt>备注</dt><dd>{{ snapshot.note }}</dd></div></dl><p v-if="snapshot.type === 'market'" class="ticket-help">市价金额仅供参考。</p></div>
      <div v-if="isAmend" class="ticket-amend-confirm app-numeric">已成 {{ number(snapshot.filled) }} 股不变 · 改后未成交 {{ number(snapshot.remaining) }} 股</div><p v-if="error" class="ticket-error" role="alert">{{ error }}</p>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="back">返回</button><button type="button" class="ticket-primary" @click="confirmDemo">确认{{ isAmend ? '改单' : snapshot.side === 'buy' ? '买入' : '卖出' }}</button></footer>
    </template>
    <template v-else-if="page === 'done'">
      <div class="order-entry-scroll ticket-complete"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><path d="m14 24 7 7 14-14"/></svg><h3>{{ isAmend ? '改单已完成' : '订单已确认' }}</h3><p v-if="doneMessage">{{ doneMessage }}</p><p v-if="snapshot">{{ snapshot.symbol.name }} · {{ snapshot.side === 'buy' ? '买入' : '卖出' }} {{ number(snapshot.quantity) }} 股</p></div><footer class="ticket-footer ticket-secondary-actions"><button type="button" class="ticket-primary" @click="close">完成</button></footer>
    </template>
  </van-popup>
</template>
