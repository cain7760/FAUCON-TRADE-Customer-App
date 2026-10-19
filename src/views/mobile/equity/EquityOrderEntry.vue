<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { accounts, demoRecords } from './fixtures.js'
import { accountLabel, formatNumber } from './model.js'
import { algorithmOptions, defaultOrderAlgorithm, demoOrderCash, largeOrderAmount, orderError, orderEstimates, validPov } from './orderModel.js'
import './order-entry.css'

const props = defineProps({ show: Boolean, context: { type: Object, required: true } })
const emit = defineEmits(['update:show', 'closed'])
const closeButton = ref(null), heading = ref(null), searchInput = ref(null), quantityInput = ref(null)
const page = ref('form'), error = ref(''), snapshot = ref(null), search = ref(''), market = ref('ALL')
const accountId = ref(accounts[0].id), symbolCode = ref('000001'), manualSymbol = ref(null)
const draft = reactive({ execution: 'lowTouch', type: 'limit', price: '', mode: 'quantity', value: '', unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: 'DMA', pov: { hours: 1, minutes: 0, participation: 10 }, note: '' })
const algorithmDraft = reactive({ value: 'DMA', hours: 1, minutes: 0, participation: 10 })
const customDraft = reactive({ name: '', code: '', market: 'A' })
const instruments = demoRecords.positions.filter(row => row.account === accounts[0].id)
const isLocked = computed(() => props.context.action !== 'new')
const isClose = computed(() => props.context.action === 'close')
const title = computed(() => ({ symbols: '选择下单标的', algorithm: '执行算法', custom: '手动新增标的', confirm: '确认订单', done: '模拟确认完成' }[page.value] || (isClose.value ? '平仓' : isLocked.value ? '追单' : '下单')))
const symbol = computed(() => manualSymbol.value || instruments.find(row => row.code === symbolCode.value))
const position = computed(() => demoRecords.positions.find(row => row.account === accountId.value && row.code === symbolCode.value))
const estimate = computed(() => orderEstimates(draft, symbol.value, demoOrderCash[accountId.value], position.value?.available))
const filteredSymbols = computed(() => instruments.filter(row => (market.value === 'ALL' || market.value === 'A') && `${row.name}${row.code}`.toLowerCase().includes(search.value.trim().toLowerCase())))
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
const basicValid = computed(() => symbol.value && estimate.value.price > 0 && (draft.algorithm !== 'POV' || validPov(draft.pov)) && !lotError.value)
const number = value => formatNumber(value, 0, false)
const money = value => formatNumber(value, 2)
const close = () => emit('update:show', false)
let formReturnFocus = null
function resetSize() { draft.value = ''; draft.fraction = 0; if (isPercent.value) draft.mode = 'quantity'; error.value = '' }
function initialize() {
  const record = props.context.record
  accountId.value = record?.account || accounts[0].id
  symbolCode.value = record?.code || instruments[0].code
  manualSymbol.value = null
  Object.assign(draft, { execution: 'lowTouch', type: 'limit', price: symbol.value?.price || '', mode: 'quantity', value: '', unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: defaultOrderAlgorithm(symbol.value?.market), pov: { hours: 1, minutes: 0, participation: 10 }, note: '' })
  page.value = 'form'; snapshot.value = null; error.value = ''; search.value = ''; market.value = 'ALL'
}
watch(() => props.show, show => { if (show) initialize() }, { immediate: true })
watch(draft, () => { error.value = '' }, { deep: true })
function navigate(next, event) {
  formReturnFocus = event?.currentTarget || formReturnFocus
  error.value = ''
  if (next === 'symbols') { search.value = ''; market.value = 'ALL' }
  if (next === 'algorithm') Object.assign(algorithmDraft, { value: draft.algorithm, ...draft.pov })
  page.value = next
  nextTick(() => (next === 'symbols' ? searchInput.value : heading.value)?.focus())
}
function back() {
  if (page.value === 'done') { close(); return }
  page.value = 'form'; error.value = ''
  nextTick(() => (formReturnFocus?.isConnected ? formReturnFocus : closeButton.value)?.focus())
}
function selectSymbol(row) {
  symbolCode.value = row.code; manualSymbol.value = row.isManual ? row : null
  draft.price = row.price ?? ''; draft.algorithm = defaultOrderAlgorithm(row.market); draft.note = ''; resetSize(); back()
}
function clearSymbol() { symbolCode.value = ''; manualSymbol.value = null; draft.price = ''; resetSize() }
function changeAccount() { draft.note = ''; resetSize() }
function changeExecution(value) {
  draft.execution = value
  if (manualSymbol.value) selectSymbol(instruments[0])
  draft.note = ''; resetSize()
}
function setType(value) { draft.type = value; if (value === 'market') draft.mode = 'quantity'; resetSize() }
function setMode(value) { draft.mode = value; resetSize() }
function stepPrice(direction) { draft.price = Number(Math.max(0, (Number(draft.price) || 0) + direction * .01).toFixed(2)) }
function stepValue(direction) {
  if (isPercent.value) { draft.mode = 'quantity'; draft.value = 0; draft.fraction = 0 }
  const step = usesAmount.value ? (draft.amountUnit === 'wan' ? 10000 : 1000) : (draft.unit === 'wan' ? 1 : estimate.value.lot)
  draft.value = Number(Math.max(0, (Number(draft.value) || 0) + direction * step).toFixed(usesAmount.value ? 2 : 0))
}
function selectFraction(value) { draft.mode = 'percentage'; draft.fraction = value; error.value = '' }
function editPercentage() { draft.mode = 'quantity'; draft.unit = 'shares'; draft.value = 0; draft.fraction = 0; nextTick(() => quantityInput.value?.focus()) }
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
  if (isLocked.value && side !== (isClose.value ? 'sell' : 'buy')) return
  const message = orderError(draft, symbol.value, estimate.value, side)
  if (message) { error.value = message; return }
  snapshot.value = { side, symbol: { ...symbol.value }, account: accountId.value, execution: draft.execution, type: draft.type, price: estimate.value.price, quantity: estimate.value[side], amount: side === 'buy' ? estimate.value.buyAmount : estimate.value.sellAmount, algorithm: algorithmLabel.value, pov: { ...draft.pov }, inputAmount: usesAmount.value ? estimate.value.inputAmount : null, note: draft.note.trim() }
  navigate('confirm', event)
}
function confirmDemo() { page.value = 'done'; nextTick(() => heading.value?.focus()) }
function handleKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); page.value === 'form' ? close() : back(); return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
  if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === heading.value)) { event.preventDefault(); controls.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round transition-appear class="equity-filter-sheet equity-order-sheet" overlay-class="equity-sheet-overlay" :duration=".2" :aria-label="title" aria-modal="true" @update:show="emit('update:show', $event)" @opened="closeButton?.focus()" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header class="order-sheet-heading">
      <button v-if="page !== 'form'" type="button" class="equity-icon-button" aria-label="返回下单面板" @click="back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
      <h2 ref="heading" tabindex="-1">{{ title }}</h2><span class="order-demo-label">模拟</span>
      <button ref="closeButton" type="button" class="equity-icon-button" aria-label="关闭下单面板" @click="close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
    </header>
    <template v-if="page === 'form'">
      <div class="order-entry-scroll">
        <div class="ticket-segment ticket-execution" role="group" aria-label="订单类型"><button v-for="item in [['lowTouch', '系统单'], ['highTouch', '手工单']]" :key="item[0]" type="button" :aria-pressed="draft.execution === item[0]" @click="changeExecution(item[0])">{{ item[1] }}</button></div>
        <label class="ticket-account"><span>下单账户</span><select v-model="accountId" :disabled="isLocked" aria-label="下单账户" @change="changeAccount"><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.id }} · {{ account.name }}</option></select></label>
        <section class="ticket-field">
          <div class="ticket-caption"><span>下单标的</span><span class="ticket-symbol-tags"><b>CNY</b><span>40% IA</span></span></div>
          <div class="ticket-symbol-control"><button type="button" :disabled="isLocked" :aria-label="symbol ? `下单标的 ${symbol.name} ${symbol.code}` : '选择下单标的'" @click="navigate('symbols', $event)"><template v-if="symbol"><strong>{{ symbol.name }}</strong><span class="app-numeric">（{{ symbol.code }}）</span></template><span v-else>搜索标的名称 / 代码</span></button><button v-if="symbol && !isLocked" type="button" class="equity-icon-button" aria-label="清空下单标的" @click="clearSymbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
        </section>
        <section class="ticket-field">
          <div class="ticket-caption"><label for="mobile-order-price">订单价格</label><div class="ticket-segment" role="group" aria-label="价格类型"><button v-for="item in [['limit', '限价'], ['market', '市价']]" :key="item[0]" type="button" :aria-pressed="draft.type === item[0]" @click="setType(item[0])">{{ item[1] }}</button></div></div>
          <div v-if="draft.type === 'limit'" class="ticket-number-control" :class="{ 'has-error': draft.price !== '' && !(draft.price > 0) }"><button type="button" aria-label="减少订单价格" :disabled="!symbol || !(draft.price > 0)" @click="stepPrice(-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><input id="mobile-order-price" v-model="draft.price" :disabled="!symbol" type="number" inputmode="decimal" min="0" step="0.01" placeholder="请输入" aria-describedby="ticket-price-error"><button type="button" aria-label="增加订单价格" :disabled="!symbol" @click="stepPrice(1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button></div>
          <div v-else class="ticket-market-price">以市场价格成交</div><p v-if="draft.type === 'limit' && draft.price !== '' && !(draft.price > 0)" id="ticket-price-error" class="ticket-error">订单价格须大于 0</p>
        </section>
        <section class="ticket-field">
          <div class="ticket-caption"><label :for="isPercent ? 'mobile-order-percent' : 'mobile-order-quantity'">{{ usesAmount ? '订单金额' : '订单数量' }}</label><span v-if="!usesAmount && symbol && !symbol.isManual" class="ticket-lot app-numeric">{{ estimate.lot }}股/手</span><div class="ticket-segment" role="group" aria-label="下单单位类型"><button type="button" :aria-pressed="!usesAmount" @click="setMode('quantity')">数量</button><button v-if="draft.type === 'limit'" type="button" :aria-pressed="usesAmount" @click="setMode('amount')">金额</button></div></div>
          <div v-if="isPercent" class="ticket-percentage-control"><input id="mobile-order-percent" :value="`${draft.fraction}%`" readonly aria-label="订单数量百分比，点击手动输入" @focus="editPercentage"><span>{{ isLocked ? (isClose ? '最大可卖' : '最大可买') : '最大可买 / 可卖' }}</span></div>
          <div v-else class="ticket-number-control ticket-quantity-control" :class="{ 'has-error': lotError }"><button type="button" aria-label="减少订单数量或金额" :disabled="!symbol || !(draft.value > 0)" @click="stepValue(-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><input id="mobile-order-quantity" ref="quantityInput" v-model="displayValue" :disabled="!symbol" type="number" :inputmode="usesAmount ? 'decimal' : 'numeric'" min="0" :step="usesAmount ? '.01' : '1'" placeholder="请输入" :aria-label="usesAmount ? '订单金额' : '订单数量'"><button type="button" aria-label="增加订单数量或金额" :disabled="!symbol" @click="stepValue(1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button><select v-if="usesAmount" v-model="draft.amountUnit" aria-label="金额单位"><option value="yuan">元</option><option value="wan">万元</option></select><select v-else v-model="draft.unit" aria-label="数量单位" @change="resetSize"><option value="shares">股</option><option value="wan">万股</option></select></div>
          <p v-if="lotError" class="ticket-error" role="alert">订单数量须为 {{ estimate.lot }} 股的整数倍</p><p v-if="usesAmount && estimate.inputAmount > largeOrderAmount" class="ticket-warning">大额订单，请核对委托金额</p>
        </section>
        <div class="ticket-algorithm-row"><span>执行算法</span><button type="button" :aria-label="`配置执行算法 ${algorithmLabel}`" @click="navigate('algorithm', $event)"><b class="app-numeric">{{ algorithmLabel }}</b><span v-if="draft.algorithm === 'DMA'" class="ticket-algorithm-description">Direct Market Access</span><span v-else-if="draft.algorithm === 'POV'" class="app-numeric">{{ draft.pov.hours }}时{{ draft.pov.minutes }}分 · {{ draft.pov.participation }}%</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button></div>
        <div v-if="!isManual" class="ticket-fractions" role="group" aria-label="快捷下单比例"><button v-for="value in [0, 25, 50, 75, 100]" :key="value" type="button" :aria-pressed="isPercent && draft.fraction === value" @click="selectFraction(value)">{{ value }}%</button></div>
        <dl v-if="!isManual" class="ticket-estimates" aria-label="订单预估"><div><dt>最大可买</dt><dd>{{ number(estimate.maxBuy) }} 股</dd></div><div><dt>最大可卖</dt><dd>{{ number(estimate.maxSell) }} 股</dd></div><div><dt>买入预估</dt><dd>{{ estimate.buy > 0 ? number(estimate.buy) + ' 股' : '--' }}</dd></div><div><dt>卖出预估</dt><dd>{{ estimate.sell > 0 ? number(estimate.sell) + ' 股' : '--' }}</dd></div><div><dt>买入金额 (CNY)</dt><dd>{{ estimate.buyAmount > 0 ? money(estimate.buyAmount) : '--' }}</dd></div><div><dt>卖出金额 (CNY)</dt><dd>{{ estimate.sellAmount > 0 ? money(estimate.sellAmount) : '--' }}</dd></div></dl>
        <label v-if="isManual" class="ticket-note"><span>备注 <small>{{ draft.note.length }}/200</small></span><textarea v-model="draft.note" maxlength="200" rows="3" placeholder="请输入备注"></textarea></label><p v-if="symbol?.isManual" class="ticket-warning">非标准标的无行情和持仓校验，仅供模拟填写。</p>
      </div>
<footer class="ticket-footer"><p v-if="error" class="ticket-error" role="alert">{{ error }}</p><div class="ticket-trade-buttons"><button v-if="!isLocked || !isClose" type="button" class="ticket-buy" :disabled="!basicValid || !(estimate.buy > 0)" @click="preview('buy', $event)"><strong>买入 <span>(BUY)</span></strong><span>多头开仓 / 追买</span></button><button v-if="!isLocked || isClose" type="button" class="ticket-sell" :disabled="!basicValid || !(estimate.sell > 0)" @click="preview('sell', $event)"><strong>卖出 <span>(SELL)</span></strong><span>多头平仓 / 止盈</span></button></div></footer>
    </template>
    <template v-else-if="page === 'symbols'">
      <div class="order-entry-scroll ticket-picker"><input ref="searchInput" v-model="search" class="ticket-search" placeholder="搜索标的名称 / 代码" aria-label="搜索下单标的"><div class="ticket-segment ticket-market-tabs" role="group" aria-label="标的市场"><button v-for="item in [['ALL', '全部'], ['A', 'A股'], ['HK', '港股'], ['US', '美股']]" :key="item[0]" type="button" :aria-pressed="market === item[0]" @click="market = item[0]">{{ item[1] }}</button></div><button v-for="row in filteredSymbols" :key="row.code" class="ticket-symbol-option" type="button" @click="selectSymbol(row)"><span><strong>{{ row.name }}</strong><small>{{ row.code }}.{{ row.market }}</small></span><span class="app-numeric">{{ money(row.price) }}</span></button><div v-if="!filteredSymbols.length" class="ticket-no-results"><p>暂无匹配标的</p><span v-if="!isManual">当前 Demo 标的库仅提供 A 股。</span><button v-else type="button" class="ticket-primary" @click="customDraft.name = search; customDraft.code = ''; navigate('custom')">手动新增标的</button></div></div>
    </template>
    <template v-else-if="page === 'algorithm'">
      <div class="order-entry-scroll ticket-settings"><div class="ticket-algorithm-options" role="group" aria-label="执行算法选项"><button v-for="option in algorithmOptions" :key="option.value" type="button" :aria-pressed="algorithmDraft.value === option.value" @click="algorithmDraft.value = option.value"><strong>{{ option.label }}</strong><span>{{ option.description }}</span></button></div><template v-if="algorithmDraft.value === 'POV'"><label>运行时间</label><div class="ticket-duration"><label><select v-model="algorithmDraft.hours" aria-label="POV运行小时"><option v-for="hour in 24" :key="hour" :value="hour - 1">{{ String(hour - 1).padStart(2, '0') }}</option></select><span>时</span></label><label><select v-model="algorithmDraft.minutes" aria-label="POV运行分钟"><option v-for="minute in 60" :key="minute" :value="minute - 1">{{ String(minute - 1).padStart(2, '0') }}</option></select><span>分</span></label></div><label for="mobile-pov-participation">市场成交占比</label><div class="ticket-participation"><input id="mobile-pov-participation" v-model="algorithmDraft.participation" type="number" inputmode="numeric" min="1" max="25" step="1"><span>%</span></div><p class="ticket-help">市场成交占比不超过 25%，运行时间不能为 0。</p><p v-if="!validPov(algorithmDraft)" class="ticket-error" role="alert">请填写有效的运行时间和成交占比</p></template></div>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="back">取消</button><button type="button" class="ticket-primary" :disabled="algorithmDraft.value === 'POV' && !validPov(algorithmDraft)" @click="applyAlgorithm">确认配置</button></footer>
    </template>
    <template v-else-if="page === 'custom'">
      <div class="order-entry-scroll ticket-settings"><p class="ticket-help">非标准标的只用于本次手工模拟订单。</p><label for="mobile-custom-name">标的名称</label><input id="mobile-custom-name" v-model="customDraft.name" maxlength="40" placeholder="请输入标的名称"><label for="mobile-custom-code">标的代码</label><input id="mobile-custom-code" v-model="customDraft.code" maxlength="24" placeholder="请输入标的代码"><label for="mobile-custom-market">所属市场</label><select id="mobile-custom-market" v-model="customDraft.market"><option value="A">A股</option><option value="HK">港股</option><option value="US">美股</option></select><p v-if="error" class="ticket-error" role="alert">{{ error }}</p></div>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="navigate('symbols')">取消</button><button type="button" class="ticket-primary" @click="addManualSymbol">新增标的</button></footer>
    </template>
    <template v-else-if="page === 'confirm' && snapshot">
      <div class="order-entry-scroll ticket-confirm"><h3><span :class="snapshot.side === 'buy' ? 'equity-positive' : 'equity-negative'">{{ snapshot.side === 'buy' ? '买入' : '卖出' }}</span> {{ snapshot.symbol.name }} <small>{{ snapshot.symbol.code }}</small></h3><dl><div><dt>订单价格 (CNY)</dt><dd>{{ snapshot.type === 'limit' ? money(snapshot.price) : '市价' }}</dd></div><div><dt>订单数量 (股)</dt><dd>{{ number(snapshot.quantity) }}</dd></div><div><dt>预估金额 (CNY)</dt><dd>{{ money(snapshot.amount) }}</dd></div><div><dt>下单账户</dt><dd>{{ accountLabel(snapshot.account) }}</dd></div><div><dt>订单类型</dt><dd>{{ snapshot.execution === 'highTouch' ? '手工单' : '系统单' }}</dd></div><div><dt>执行算法</dt><dd>{{ snapshot.algorithm }}</dd></div><template v-if="snapshot.algorithm === 'POV'"><div><dt>运行时间</dt><dd>{{ snapshot.pov.hours }} 时 {{ snapshot.pov.minutes }} 分</dd></div><div><dt>市场成交占比</dt><dd>{{ snapshot.pov.participation }}%</dd></div></template><div v-if="snapshot.inputAmount !== null"><dt>订单金额 (CNY)</dt><dd>{{ money(snapshot.inputAmount) }}</dd></div><div v-if="snapshot.note"><dt>备注</dt><dd>{{ snapshot.note }}</dd></div></dl><p class="ticket-help">{{ snapshot.type === 'market' ? '市价金额仅供参考。' : '' }}此确认仅用于本地演示，不发送委托，不变更持仓或资金。</p></div>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="back">返回修改</button><button type="button" class="ticket-primary" @click="confirmDemo">确认模拟{{ snapshot.side === 'buy' ? '买入' : '卖出' }}</button></footer>
    </template>
    <template v-else-if="page === 'done'">
      <div class="order-entry-scroll ticket-complete"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><path d="m14 24 7 7 14-14"/></svg><h3>模拟委托已确认</h3><p>未发送真实委托，持仓与资金不变。</p><p v-if="snapshot">{{ snapshot.symbol.name }} · {{ snapshot.side === 'buy' ? '买入' : '卖出' }} {{ number(snapshot.quantity) }} 股</p></div><footer class="ticket-footer ticket-secondary-actions"><button type="button" class="ticket-primary" @click="close">完成</button></footer>
    </template>
  </van-popup>
</template>
