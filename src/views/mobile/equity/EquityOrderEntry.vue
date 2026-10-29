<script setup>
import EquitySheetClose from './EquitySheetClose.vue'
import { computed, nextTick, reactive, ref, shallowRef, useId, watch } from 'vue'
import { showSuccessToast } from 'vant'
import { accounts, demoRecords, orderInstruments } from './fixtures.js'
import { accountLabel, formatNumber } from './model.js'
import { algorithmOptions, applyBookPrice, canPreviewOrder, changeOrderMode, changeOrderType, defaultOrderAlgorithm, demoOrderCash, largeOrderAmount, orderError, orderEstimates, resetOrderSize, validPov } from './orderModel.js'
import { amendmentDraft, amendmentError, amendmentEstimate, amendmentFilledAmount, amendmentPayload, remainingQuantity } from './orderActions.js'
import { orderAccountOverview } from './accountOverview.js'
import { decimalProduct, decimalSum, quantityForAmount, truncateDecimal } from './decimalMath.js'
import { orderNotional, pricePrecision } from './orderCalculations.js'
import EquitySymbolPicker from './EquitySymbolPicker.vue'
import { canUseMarketOrder, normalizeOrderType, orderTypeError } from './orderMarketRules.js'
import EquityOrderBook from './EquityOrderBook.vue'
import EquityAccountPicker from './EquityAccountPicker.vue'
import EquityAccountTrigger from './EquityAccountTrigger.vue'
import EquityAccountSummary from './EquityAccountSummary.vue'
import './order-entry.css'

const props = defineProps({ show: Boolean, context: { type: Object, required: true }, layout: { type: String, default: 'split' }, design: { type: String, default: 'baseline' }, fullCapabilities: Boolean, overviewAccountIds: { type: Array, default: () => [] }, positions: Array, accountCash: Object, systemRunning: { type: Boolean, default: true } })
const emit = defineEmits(['update:show', 'closed', 'amend', 'order'])
const closeButton = ref(null), heading = ref(null), algorithmHeading = ref(null), symbolPicker = ref(null), accountTrigger = ref(null)
const page = ref('form'), error = ref(''), snapshot = ref(null)
const showsFraction = ref(false), sizeInput = ref(null)
const amendmentTotalAmount = ref(0), amendmentShareQuantity = ref(0)
// 对照基线隐藏手工单入口，新版按 PC 保留系统/手工切换能力。
const isExecutionSwitchVisible = computed(() => props.fullCapabilities)
const isPaused = computed(() => props.fullCapabilities && props.systemRunning === false)
// 视图偏好不随下单子页面或账户切换重置，避免隐藏后的资金意外重新显示。
const assetsVisible = ref(true), assetsCollapsed = ref(true)
const accountId = ref(accounts[0].id), symbolCode = ref('000001'), manualSymbol = ref(null)
const draft = reactive({ execution: 'lowTouch', type: 'limit', price: '', mode: 'quantity', value: '', unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: 'DMA', pov: { hours: 1, minutes: 0, participation: 10 }, note: '' })
const algorithmDraft = reactive({ value: 'DMA', hours: 1, minutes: 0, participation: 10 })
const customDraft = reactive({ name: '', code: '', market: 'A' })
const instruments = orderInstruments
const isLocked = computed(() => props.context.action !== 'new')
const isClose = computed(() => props.context.action === 'close')
const isAmend = computed(() => props.context.action === 'amend')
const doneMessage = ref('')
const title = computed(() => ({ accounts: '选择下单账户', symbols: '标的搜索', custom: '手动新增标的', confirm: isAmend.value ? '确认改单' : snapshot.value ? `确认${snapshot.value.side === 'buy' ? '买入' : '卖出'} ${number(snapshot.value.quantity)} 股吗？` : '确认订单', done: '确认完成' }[page.value] || (isAmend.value ? '改单' : isClose.value ? '平仓' : isLocked.value ? '追单' : '下单')))
const symbol = computed(() => manualSymbol.value || instruments.find(row => row.code === symbolCode.value) || (isLocked.value ? props.context.record : null))
const symbolCurrency = computed(() => symbol.value?.currency || ({ A: 'CNY', SH: 'CNY', SZ: 'CNY', HK: 'HKD', US: 'USD' }[symbol.value?.market]) || '--')
const symbolIaLabel = computed(() => Number.isFinite(symbol.value?.iaRate) ? `${symbol.value.iaRate}% IA` : '--')
const hasReferenceQuote = computed(() => Boolean(symbol.value?.code && Number(symbol.value.price) > 0 && !symbol.value.isManual))
const quoteDelta = computed(() => Number(symbol.value?.preClose) > 0 ? Math.abs(decimalSum(symbol.value.price, -symbol.value.preClose)) : null)
const priceTypeOptions = computed(() => canUseMarketOrder(symbol.value) ? [['limit', '限价'], ['market', '市价']] : [['limit', '限价']])
const positions = computed(() => props.positions || demoRecords.positions)
const cashBalances = computed(() => props.accountCash || demoOrderCash)
const position = computed(() => positions.value.find(row => row.account === accountId.value && row.code === symbolCode.value && row.market === symbol.value?.market))
const amendmentOptions = computed(() => ({ pcParity: props.fullCapabilities, totalAmount: amendmentTotalAmount.value }))
const estimate = computed(() => isAmend.value ? amendmentEstimate(draft, props.context.record, symbol.value, cashBalances.value[accountId.value], amendmentOptions.value) : orderEstimates(draft, symbol.value, cashBalances.value[accountId.value], position.value?.available))
const positionCodes = computed(() => positions.value.filter(row => row.account === accountId.value && row.qty > 0).map(row => row.code))
const accountOverview = computed(() => orderAccountOverview(props.fullCapabilities && props.overviewAccountIds?.length ? props.overviewAccountIds : accountId.value, positions.value, cashBalances.value))
const algorithmLabel = computed(() => algorithmOptions.find(option => option.value === draft.algorithm)?.label)
const algorithmDialogOptions = computed(() => props.design === 'baseline' ? algorithmOptions.filter(option => option.value === 'POV') : algorithmOptions)
const algorithmMenuOpen = ref(false), algorithmMenuTarget = shallowRef(null), algorithmTrigger = ref(null), algorithmOptionsElement = ref(null)
const algorithmMenuId = `order-algorithm-${useId()}`
function openAlgorithmMenu(event) {
  algorithmMenuTarget.value = event.currentTarget.closest('.equity-order-sheet')
  algorithmMenuOpen.value = event.type === 'keydown' || !algorithmMenuOpen.value
  if (algorithmMenuOpen.value) nextTick(focusAlgorithmOption)
}
function focusAlgorithmOption() { algorithmOptionsElement.value?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }) }
function selectAlgorithm(value) {
  if (!algorithmOptions.some(option => option.value === value)) return
  algorithmMenuOpen.value = false
  if (value === 'POV') {
    navigate('algorithm', { currentTarget: algorithmTrigger.value })
    algorithmDraft.value = 'POV'
  } else {
    draft.algorithm = value
    nextTick(() => algorithmTrigger.value?.focus({ preventScroll: true }))
  }
}
function handleAlgorithmMenuKeyboard(event) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    event.stopPropagation()
    if (event.key === 'Escape') event.preventDefault()
    algorithmMenuOpen.value = false
    algorithmTrigger.value?.focus({ preventScroll: true })
    return
  }
  const options = [...(algorithmOptionsElement.value?.querySelectorAll('button') || [])]
  const index = options.indexOf(event.target)
  const next = { ArrowDown: (index + 1) % options.length, ArrowUp: (index + options.length - 1) % options.length, Home: 0, End: options.length - 1 }[event.key]
  if (next === undefined) return
  event.preventDefault(); event.stopPropagation(); options[next]?.focus()
}
watch([() => props.show, page, symbolCode], () => { algorithmMenuOpen.value = false })
watch(algorithmMenuOpen, (open, _, onCleanup) => {
  if (!open) return
  const dismiss = event => {
    if (!algorithmTrigger.value?.contains(event.target) && !algorithmOptionsElement.value?.contains(event.target)) algorithmMenuOpen.value = false
  }
  document.addEventListener('pointerdown', dismiss)
  onCleanup(() => document.removeEventListener('pointerdown', dismiss))
})
const usesAmount = computed(() => draft.mode === 'amount')
// 金额始终以元保存，单位切换只转换输入框的显示值。
const displayValue = computed({
  get: () => props.fullCapabilities && isAmend.value && usesAmount.value
    ? (decimalSum(amendmentTotalAmount.value, -amendmentFilledAmount(props.context.record))) / (draft.amountUnit === 'wan' ? 10000 : 1)
    : draft.value === '' ? '' : Number(draft.value) / (usesAmount.value && draft.amountUnit === 'wan' ? 10000 : 1),
  set: value => {
    const next = value === '' ? '' : decimalProduct(value, usesAmount.value && draft.amountUnit === 'wan' ? 10000 : 1)
    if (next !== draft.value) draft.fraction = 0
    draft.value = next
    if (props.fullCapabilities && isAmend.value && usesAmount.value) amendmentTotalAmount.value = decimalSum(Number(next), amendmentFilledAmount(props.context.record))
  },
})
const quantityUnit = computed({
  get: () => draft.unit,
  set: unit => {
    if (props.fullCapabilities && isAmend.value && draft.value !== '') {
      draft.value = decimalProduct(draft.value, draft.unit === 'wan' ? 10000 : 1) / (unit === 'wan' ? 10000 : 1)
    }
    draft.unit = unit
  },
})
const unitMenuOpen = ref(false), unitMenuTarget = shallowRef(null), unitTrigger = ref(null), unitOptionsElement = ref(null)
const unitMenuId = `order-unit-${useId()}`
const unitOptions = computed(() => usesAmount.value ? [['yuan', '元'], ['wan', '万元']] : [['shares', '股'], ['wan', '万股']])
const selectedUnit = computed(() => usesAmount.value ? draft.amountUnit : quantityUnit.value)
const unitLabel = computed(() => usesAmount.value ? '金额单位' : '数量单位')
const selectedUnitLabel = computed(() => unitOptions.value.find(([value]) => value === selectedUnit.value)?.[1])
function openUnitMenu(event) {
  unitMenuTarget.value = event.currentTarget.closest('.equity-order-sheet')
  unitMenuOpen.value = event.type === 'keydown' || !unitMenuOpen.value
  if (unitMenuOpen.value) nextTick(focusUnitOption)
}
function focusUnitOption() { unitOptionsElement.value?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }) }
function closeUnitMenu(restoreFocus = false) {
  unitMenuOpen.value = false
  if (restoreFocus) nextTick(() => unitTrigger.value?.focus({ preventScroll: true }))
}
function selectUnit(value) {
  if (value !== selectedUnit.value) {
    if (usesAmount.value) draft.amountUnit = value
    else { quantityUnit.value = value; changeQuantityUnit() }
  }
  closeUnitMenu(true)
}
function handleUnitKeyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeUnitMenu(true); return }
  if (event.key === 'Tab') { event.stopPropagation(); unitTrigger.value?.focus(); closeUnitMenu(); return }
  const options = [...(unitOptionsElement.value?.querySelectorAll('button') || [])]
  const index = options.indexOf(event.target)
  const next = { ArrowDown: (index + 1) % options.length, ArrowUp: (index + options.length - 1) % options.length, Home: 0, End: options.length - 1 }[event.key]
  if (next === undefined) return
  event.preventDefault(); event.stopPropagation(); options[next]?.focus()
}
watch([() => props.show, page, usesAmount, showsFraction, symbolCode], () => closeUnitMenu())
// Vant 的外部关闭监听 touchstart；补齐桌面鼠标与触控笔，关闭时移除监听。
watch(unitMenuOpen, (open, _, onCleanup) => {
  if (!open) return
  const dismiss = event => {
    if (!unitTrigger.value?.contains(event.target) && !unitOptionsElement.value?.contains(event.target)) closeUnitMenu()
  }
  document.addEventListener('pointerdown', dismiss)
  onCleanup(() => document.removeEventListener('pointerdown', dismiss))
})
// 基线保存实际数量；新版以 PC 的 percentage 模式分别计算买卖数量。
const sizeInputValue = computed({
  get: () => showsFraction.value ? `${draft.fraction}%` : displayValue.value,
  set: value => { showsFraction.value = false; displayValue.value = value },
})
const isManual = computed(() => draft.execution === 'highTouch')
const lotError = computed(() => draft.mode !== 'percentage' && !usesAmount.value && Number(draft.value) > 0 && estimate.value.buy % estimate.value.lot !== 0)
const showBuy = computed(() => isAmend.value ? props.context.record.side === 'buy' : !isLocked.value || !isClose.value)
const showSell = computed(() => isAmend.value ? props.context.record.side === 'sell' : !isLocked.value || isClose.value)
const number = value => formatNumber(value, 0, false)
const money = value => formatNumber(value, 2)
const priceText = value => formatNumber(value, pricePrecision(symbol.value))
const close = () => emit('update:show', false)
let formReturnFocus = null
function resetSize() { showsFraction.value = false; resetOrderSize(draft); error.value = '' }
function initialize() {
  const record = props.context.record
  showsFraction.value = false
  assetsCollapsed.value = true
  accountId.value = record?.account || props.overviewAccountIds?.[0] || accounts[0].id
  symbolCode.value = record?.code || instruments[0].code
  manualSymbol.value = null
  Object.assign(draft, { execution: 'lowTouch', type: 'limit', price: symbol.value?.price || '', mode: 'quantity', value: '', unit: 'shares', amountUnit: 'yuan', fraction: 0, algorithm: defaultOrderAlgorithm(symbol.value?.market), pov: { hours: 1, minutes: 0, participation: 10 }, note: '' })
  // PC 持仓点“下单”只继承明确执行类型，来源集合不等同于本次委托类型。
  if (props.fullCapabilities && props.context.action === 'new') {
    draft.execution = (record?.executionType || (record?.orderType === '手工单' ? 'highTouch' : 'lowTouch')) === 'highTouch' ? 'highTouch' : 'lowTouch'
  }
  if (isAmend.value) {
    amendmentTotalAmount.value = record.inputAmount ?? orderNotional(record.quantity, record.price || 0)
    amendmentShareQuantity.value = remainingQuantity(record)
    Object.assign(draft, amendmentDraft(record, amendmentOptions.value))
  }
  page.value = 'form'; snapshot.value = null; error.value = ''; doneMessage.value = ''
}
watch(() => props.show, show => { if (show) initialize() }, { immediate: true })
watch(draft, () => { error.value = '' }, { deep: true })
watch([symbol, () => draft.type], () => { draft.type = normalizeOrderType(draft.type, symbol.value) }, { immediate: true })
watch(() => draft.price, () => {
  if (props.fullCapabilities && (draft.mode === 'percentage' || isClose.value || isAmend.value)) return
  draft.fraction = 0; showsFraction.value = false
})
watch(() => [draft.value, draft.unit, draft.mode, estimate.value.maxSell, estimate.value.sell, estimate.value.maxBuy, estimate.value.buy], () => {
  if (props.fullCapabilities && (isClose.value || isAmend.value) && draft.mode !== 'percentage') {
    const side = isAmend.value ? props.context.record.side : 'sell'
    const maximum = estimate.value[side === 'buy' ? 'maxBuy' : 'maxSell']
    const fraction = maximum > 0 ? Math.min(100, Math.max(0, estimate.value[side] / maximum * 100)) : 0
    draft.fraction = isAmend.value ? Math.round(fraction) : fraction
  }
})
function navigate(next, event) {
  formReturnFocus = event?.currentTarget || formReturnFocus
  error.value = ''
  if (next === 'algorithm') Object.assign(algorithmDraft, { value: draft.algorithm, ...draft.pov })
  page.value = next
  if (next !== 'algorithm') nextTick(() => next === 'symbols' ? symbolPicker.value?.focusSearch() : heading.value?.focus())
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
function setType(value) {
  if (props.fullCapabilities && normalizeOrderType(value, symbol.value) === draft.type) return
  if (props.fullCapabilities && isAmend.value) {
    draft.type = normalizeOrderType(value, symbol.value)
    if (draft.type === 'market') setMode('quantity')
    return
  }
  showsFraction.value = false; changeOrderType(draft, value, symbol.value)
}
function setMode(value) {
  if (props.fullCapabilities && isAmend.value) {
    if (draft.mode === value) return
    if (draft.mode === 'quantity') amendmentShareQuantity.value = decimalProduct(draft.value, draft.unit === 'wan' ? 10000 : 1)
    draft.mode = value
    draft.value = value === 'amount' ? decimalSum(amendmentTotalAmount.value, -amendmentFilledAmount(props.context.record)) : amendmentShareQuantity.value / (draft.unit === 'wan' ? 10000 : 1)
    return
  }
  showsFraction.value = false; changeOrderMode(draft, value)
}
function setBookPrice(price) {
  if (props.fullCapabilities && isAmend.value) { setType('limit'); draft.price = price; return }
  applyBookPrice(draft, price)
  showsFraction.value = props.fullCapabilities && draft.mode === 'percentage'
}
function stepPrice(direction) { draft.price = Math.max(0, decimalSum(Number(draft.price) || 0, decimalProduct(direction, 10 ** -pricePrecision(symbol.value)))) }
function selectFraction(value) {
  if (!symbol.value) return
  const fraction = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  if (props.fullCapabilities && !isAmend.value) {
    draft.mode = 'percentage'; draft.fraction = fraction
    showsFraction.value = true; error.value = ''
    return
  }
  const maximum = isClose.value || (isAmend.value && props.context.record.side === 'sell') ? estimate.value.maxSell : estimate.value.maxBuy
  const quantity = quantityForAmount(decimalProduct(maximum, fraction, .01), 1, estimate.value.lot)
  // 与 Customer size() 一致地保存实际数量/金额，界面单独展示当前比例。
  draft.value = usesAmount.value ? orderNotional(quantity, estimate.value.price) : draft.unit === 'wan' ? quantity / 10000 : quantity
  if (props.fullCapabilities && isAmend.value && usesAmount.value) amendmentTotalAmount.value = decimalSum(amendmentFilledAmount(props.context.record), orderNotional(quantity, estimate.value.price))
  draft.fraction = fraction
  showsFraction.value = !(props.fullCapabilities && isAmend.value)
  error.value = ''
}
function normalizeInput(field, precision) { if (draft[field] !== '' && Number.isFinite(Number(draft[field]))) draft[field] = truncateDecimal(draft[field], precision) }
function normalizeSize() {
  if (showsFraction.value) return
  if (usesAmount.value && displayValue.value !== '' && Number.isFinite(Number(displayValue.value))) displayValue.value = truncateDecimal(displayValue.value, 2)
}
function changeQuantityUnit() { if (!(props.fullCapabilities && isAmend.value)) resetSize() }
function editSize() {
  if (!showsFraction.value) return
  showsFraction.value = false
  if (props.fullCapabilities) {
    draft.mode = 'quantity'; draft.unit = 'shares'; draft.value = 0; draft.fraction = 0
  }
  nextTick(() => { sizeInput.value?.focus?.(); sizeInput.value?.select() })
}
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
  if (isPaused.value) { error.value = '当前时间系统暂停交易，暂不支持下单'; return }
  if (isAmend.value) {
    const row = props.context.record
    const validationDraft = props.fullCapabilities && draft.mode === 'quantity' && draft.unit === 'wan' ? { ...draft, unit: 'shares', value: decimalProduct(draft.value, 10000) } : draft
    const message = amendmentError(validationDraft, row, symbol.value, estimate.value, amendmentOptions.value)
    if (message) { error.value = message; return }
    const amendment = { ...amendmentPayload(draft, row, estimate.value, amendmentOptions.value), referencePrice: estimate.value.price }
    snapshot.value = { side: row.side, symbol: { ...symbol.value }, account: row.account, execution: draft.execution, type: draft.type,
      price: estimate.value.price, quantity: amendment.quantity, amount: orderNotional(estimate.value[row.side], estimate.value.price),
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
  if (isPaused.value) { error.value = '当前时间系统暂停交易，暂不支持下单'; return }
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
  emit('order', snapshot.value, result => {
    if (result.error) { error.value = result.error; return }
    resetSize(); draft.note = ''
    doneMessage.value = result.message || '订单已加入所有订单，状态为待报。'
    page.value = 'done'; nextTick(() => heading.value?.focus())
  })
}
function handleKeyboard(event) {
  if (algorithmMenuOpen.value) { handleAlgorithmMenuKeyboard(event); return }
  if (event.key === 'Escape') { event.preventDefault(); page.value === 'form' ? close() : back(); return }
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
  const activeHeading = page.value === 'algorithm' ? algorithmHeading.value : heading.value
  if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === activeHeading)) { event.preventDefault(); controls.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
}
</script>

<template>
  <van-popup :show="show" position="bottom" round transition-appear class="equity-filter-sheet equity-order-sheet ticket-entry-sheet" :class="{ 'equity-symbol-sheet': page === 'symbols', 'equity-account-sheet': page === 'accounts', 'ticket-reference-layout': page === 'form' || page === 'algorithm', 'ticket-baseline-order-entry': design === 'baseline' }" overlay-class="equity-sheet-overlay" :overlay-props="{ 'aria-hidden': page === 'algorithm' ? 'true' : undefined, tabindex: page === 'algorithm' ? -1 : 0 }" :duration=".2" :aria-label="title" aria-modal="true" :aria-hidden="page === 'algorithm' ? 'true' : undefined" :inert="page === 'algorithm' ? true : undefined" @update:show="updatePopup" @opened="closeButton?.focus()" @closed="emit('closed')" @keydown="handleKeyboard">
    <div class="sheet-handle" aria-hidden="true"></div>
    <header v-if="page !== 'symbols'" class="order-sheet-heading">
      <button v-if="!['form', 'accounts', 'algorithm'].includes(page)" type="button" class="equity-icon-button" aria-label="返回下单面板" @click="back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
      <h2 ref="heading" tabindex="-1">{{ title }}</h2>
      <div v-if="page === 'form' || page === 'algorithm'" class="ticket-account ticket-header-account">
        <EquityAccountTrigger ref="accountTrigger" :label="accounts.find(account => account.id === accountId)?.name || accountId" :compact="design !== 'focus'" :disabled="isLocked" :aria-label="`下单账户 ${accountLabel(accountId)}`" :title="accountLabel(accountId)" @click="navigate('accounts', $event)" />
      </div>
      <EquitySheetClose ref="closeButton" :aria-label="page === 'accounts' ? '关闭账户选择' : '关闭下单面板'" @click="page === 'accounts' ? back() : close()" />
    </header>
    <p v-if="isPaused && page !== 'done'" class="ticket-error" role="status">当前时间系统暂停交易，暂不支持下单</p>
    <EquitySymbolPicker v-show="page === 'symbols'" ref="symbolPicker" :active="page === 'symbols'" :instruments="instruments" :position-codes="positionCodes" :selected-code="symbolCode" :allow-manual="isManual" @select="selectSymbol" @close="close" @manual="value => { customDraft.name = value; customDraft.code = ''; navigate('custom') }" />
    <template v-if="page === 'form' || page === 'algorithm'">
      <div class="order-entry-scroll ticket-workspace" :inert="isPaused ? true : undefined" :aria-disabled="isPaused || undefined">
        <div v-if="isExecutionSwitchVisible && !isAmend" class="ticket-segment ticket-execution" role="group" aria-label="订单类型"><button v-for="item in [['lowTouch', '系统单'], ['highTouch', '手工单']]" :key="item[0]" type="button" :aria-pressed="draft.execution === item[0]" @click="changeExecution(item[0])">{{ item[1] }}</button></div>
        <div v-if="isAmend" class="ticket-amend-original"><strong>{{ context.record.orderType }} · {{ context.record.side === 'buy' ? '买入' : '卖出' }}{{ context.record.openClose === '开' ? '开仓' : '平仓' }}</strong><span class="app-numeric">{{ context.record.orderNo }}</span><span>原数量 {{ number(context.record.quantity) }} 股 · 已成 {{ number(context.record.filledQuantity || 0) }} 股</span><span>未成交 {{ number(remainingQuantity(context.record)) }} 股；下方仅修改未成交部分。</span></div>
        <section class="ticket-order-context ticket-module" aria-label="下单标的与行情">
          <section class="ticket-field ticket-symbol-field">
            <div class="ticket-symbol-control">
              <button type="button" :disabled="isLocked" :aria-label="symbol ? `下单标的 ${symbol.name} ${symbol.code}` : '选择下单标的'" @click="navigate('symbols', $event)">
                <span class="ticket-symbol-identity"><template v-if="symbol"><strong>{{ symbol.name }}</strong><span class="app-numeric">{{ symbol.code }}.{{ symbol.market }}</span></template><span v-else class="ticket-symbol-placeholder">搜索标的名称 / 代码</span></span>
                <span class="ticket-symbol-tags"><span v-if="!symbol || !symbol.isManual">{{ symbol ? `${estimate.lot}股/手` : '--' }}</span><b>{{ symbolCurrency }}</b><span>{{ symbolIaLabel }}</span></span>
              </button>
              <div class="ticket-symbol-quote app-numeric" :class="hasReferenceQuote ? (symbol.change >= 0 ? 'equity-positive' : 'equity-negative') : ''" aria-label="标的参考行情">
                <strong>{{ hasReferenceQuote ? priceText(symbol.price) : '--' }}</strong>
                <span v-if="hasReferenceQuote && Number.isFinite(symbol.change)"><template v-if="quoteDelta !== null">{{ symbol.change >= 0 ? '+' : '-' }}{{ priceText(quoteDelta) }} · </template>{{ symbol.change >= 0 ? '+' : '' }}{{ symbol.change.toFixed(2) }}%</span><span v-else>--</span>
              </div>
              <button v-if="symbol && !isLocked" type="button" class="equity-icon-button" aria-label="清空下单标的" @click="clearSymbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
            </div>
          </section>
        </section>
        <div class="ticket-trading-stack" :class="{ 'ticket-trading-stack--split': layout === 'split', 'ticket-trading-stack--baseline': design === 'baseline' }">
          <EquityOrderBook :symbol="symbol" :compact="layout === 'split'" @quote="setBookPrice" />
          <section class="ticket-order-form ticket-module" aria-label="下单参数">
            <div class="ticket-order-fields">
              <div class="ticket-input-pair">
              <section class="ticket-field">
                <div class="ticket-caption"><label class="app-form-label" for="mobile-order-price">订单价格</label><div class="ticket-segment" role="group" aria-label="价格类型"><button v-for="item in priceTypeOptions" :key="item[0]" type="button" :aria-pressed="draft.type === item[0]" @click="setType(item[0])">{{ item[1] }}</button></div></div>
                <div v-if="draft.type === 'limit'" class="ticket-number-control ticket-price-control" :class="{ 'has-error': draft.price !== '' && !(draft.price > 0) }"><button type="button" aria-label="减少订单价格" :disabled="!symbol || !(draft.price > 0)" @click="stepPrice(-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><input id="mobile-order-price" v-model="draft.price" :disabled="!symbol" type="number" inputmode="decimal" min="0" :step="10 ** -pricePrecision(symbol)" placeholder="请输入" :aria-describedby="draft.price !== '' && !(draft.price > 0) ? 'ticket-price-error' : undefined" @blur="normalizeInput('price', pricePrecision(symbol))"><button type="button" aria-label="增加订单价格" :disabled="!symbol" @click="stepPrice(1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button></div>
                <div v-else class="ticket-market-price">以市场价格成交</div><p v-if="draft.type === 'limit' && draft.price !== '' && !(draft.price > 0)" id="ticket-price-error" class="ticket-error">订单价格须大于 0</p>
              </section>
              <section class="ticket-field">
                <div class="ticket-caption"><label class="app-form-label" for="mobile-order-quantity">{{ isAmend ? (usesAmount ? '未成交部分金额' : '未成交部分数量') : usesAmount ? '订单金额' : '订单数量' }}</label><div class="ticket-segment" role="group" aria-label="下单单位类型"><button type="button" :aria-pressed="!usesAmount" @click="setMode('quantity')">数量</button><button v-if="draft.type === 'limit'" type="button" :aria-pressed="usesAmount" @click="setMode('amount')">金额</button></div></div>
                <div class="ticket-number-control ticket-quantity-control" :class="{ 'has-error': lotError }">
                  <div class="ticket-size-value">
                    <input :key="showsFraction ? 'fraction' : 'quantity'" id="mobile-order-quantity" ref="sizeInput" v-model="sizeInputValue" :disabled="!symbol" :readonly="showsFraction" :type="showsFraction ? 'text' : 'number'" :inputmode="usesAmount || draft.unit === 'wan' ? 'decimal' : 'numeric'" min="0" :step="showsFraction ? 1 : usesAmount ? '.01' : draft.unit === 'wan' ? '.0001' : estimate.lot" placeholder="请输入" :aria-label="showsFraction ? '下单比例，点击输入实际数量或金额' : usesAmount ? '订单金额' : '订单数量'" :aria-valuetext="showsFraction ? `${draft.fraction}%` : undefined" @focus="editSize" @blur="normalizeSize">
                    <span v-if="showsFraction" class="ticket-size-capacity-label">最大可买/可卖</span>
                    <van-popover v-else v-model:show="unitMenuOpen" :id="unitMenuId" class="ticket-unit-popover" theme="dark" placement="bottom-end" trigger="manual" :teleport="unitMenuTarget" :show-arrow="false" :offset="[0, 6]" :duration=".12" role="presentation" @opened="focusUnitOption" @keydown="handleUnitKeyboard">
                      <div ref="unitOptionsElement" class="ticket-unit-options" role="group" :aria-label="unitLabel">
                        <button v-for="[value, label] in unitOptions" :key="value" type="button" role="menuitemradio" :aria-checked="selectedUnit === value" @click="selectUnit(value)"><span>{{ label }}</span><svg v-if="selectedUnit === value" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg></button>
                      </div>
                      <template #reference><button ref="unitTrigger" type="button" class="ticket-unit-trigger" :class="{ 'is-wan-unit': selectedUnit === 'wan' }" :aria-label="unitLabel" :aria-describedby="`${unitMenuId}-current`" aria-haspopup="menu" :aria-expanded="unitMenuOpen" :aria-controls="unitMenuOpen ? unitMenuId : undefined" @click="openUnitMenu" @keydown.down.prevent.stop="openUnitMenu" @keydown.up.prevent.stop="openUnitMenu"><span :id="`${unitMenuId}-current`">{{ selectedUnitLabel }}</span><span class="app-chevron" aria-hidden="true"></span></button></template>
                    </van-popover>
                  </div>
                </div>
                <p v-if="lotError" class="ticket-error" role="alert">订单数量须为 {{ estimate.lot }} 股的整数倍</p><p v-if="usesAmount && estimate.inputAmount > largeOrderAmount" class="ticket-warning">大额订单，请核对委托金额</p>
              </section>
              </div>
              <div class="ticket-algorithm-row">
                <van-popover v-if="design === 'baseline'" v-model:show="algorithmMenuOpen" :id="algorithmMenuId" class="ticket-unit-popover" theme="dark" placement="bottom-end" trigger="manual" :teleport="algorithmMenuTarget" :show-arrow="false" :offset="[0, 6]" :duration=".12" @opened="focusAlgorithmOption" @keydown="handleAlgorithmMenuKeyboard">
                  <div ref="algorithmOptionsElement" class="ticket-unit-options ticket-algorithm-options" role="menu" aria-label="执行算法选项">
                    <button v-for="option in algorithmOptions" :key="option.value" type="button" role="menuitemradio" :aria-checked="draft.algorithm === option.value" @click="selectAlgorithm(option.value)"><span>{{ option.label }}</span><svg v-if="draft.algorithm === option.value" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg></button>
                  </div>
                  <template #reference><button ref="algorithmTrigger" type="button" class="ticket-algorithm-select" :aria-label="`选择执行算法 ${algorithmLabel}`" aria-haspopup="menu" :aria-expanded="algorithmMenuOpen" :aria-controls="algorithmMenuOpen ? algorithmMenuId : undefined" @click="openAlgorithmMenu" @keydown.down.prevent.stop="openAlgorithmMenu" @keydown.up.prevent.stop="openAlgorithmMenu">
                    <span class="app-form-label">算法</span><span class="ticket-algorithm-choice"><b class="app-numeric">{{ algorithmLabel }}</b><span v-if="draft.algorithm === 'POV'" class="ticket-pov-tag app-numeric">{{ draft.pov.hours }}时{{ draft.pov.minutes }}分/{{ draft.pov.participation }}%</span></span><span class="app-chevron" aria-hidden="true"></span>
                  </button></template>
                </van-popover>
                <button v-else type="button" :aria-label="`配置执行算法 ${algorithmLabel}`" :aria-describedby="draft.algorithm === 'POV' ? 'ticket-algorithm-summary' : undefined" aria-haspopup="dialog" :aria-expanded="page === 'algorithm'" @click="navigate('algorithm', $event)">
                  <span class="ticket-algorithm-heading"><span class="app-form-label">算法</span><b class="app-numeric">{{ algorithmLabel }}</b><span class="app-chevron" aria-hidden="true"></span></span>
                  <span v-if="draft.algorithm === 'POV'" id="ticket-algorithm-summary" class="ticket-algorithm-summary"><span>运行时间<b class="app-numeric">{{ draft.pov.hours }}时{{ draft.pov.minutes }}分</b></span><span>市场成交占比<b class="app-numeric">{{ draft.pov.participation }}%</b></span></span>
                </button>
              </div>
              <div v-if="!isManual" class="ticket-fractions" role="group" aria-label="下单比例">
                <!-- 原生 range 保留鼠标拖动、触控和方向键；Vant 4 当前滑块没有鼠标拖动或方向键处理。 -->
                <input type="range" min="0" max="100" step="1" :value="draft.fraction" :disabled="!symbol" :style="{ '--ticket-fraction': `${draft.fraction}%` }" aria-label="下单比例" :aria-valuetext="`${draft.fraction}%`" @input="selectFraction($event.target.value)">
                <div class="ticket-fraction-marks"><button v-for="value in [0, 25, 50, 75, 100]" :key="value" type="button" :disabled="!symbol" :aria-pressed="showsFraction && draft.fraction === value" @click="selectFraction(value)">{{ value }}%</button></div>
              </div>
              <label v-if="isManual" class="ticket-note"><span class="app-form-label">备注 <small>{{ draft.note.length }}/200</small></span><textarea v-model="draft.note" maxlength="200" rows="3" placeholder="请输入备注"></textarea></label>
              <dl v-if="!isManual" class="ticket-estimates ticket-capacity" aria-label="下单可用数量"><div v-if="showBuy"><dt>最大可买</dt><dd>{{ number(estimate.maxBuy) }} 股</dd></div><div v-if="showSell"><dt>最大可卖</dt><dd>{{ number(estimate.maxSell) }} 股</dd></div></dl>
            </div>
          </section>
        </div>
      </div>
        <section class="ticket-order-actions ticket-module" :class="{ 'ticket-order-actions--single': !showBuy || !showSell }" aria-label="交易操作与预估"><p v-if="error" class="ticket-error" role="alert">{{ error }}</p><div v-if="isAmend" class="ticket-secondary-actions"><button type="button" class="ticket-primary" :disabled="isPaused" @click="preview(context.record.side, $event)">预览改单</button></div><div v-else class="ticket-trade-buttons"><button v-if="showBuy" type="button" class="ticket-buy" :disabled="isPaused || !canPreviewOrder(draft, symbol, estimate, 'buy')" @click="preview('buy', $event)">买入</button><button v-if="showSell" type="button" class="ticket-sell" :disabled="isPaused || !canPreviewOrder(draft, symbol, estimate, 'sell')" @click="preview('sell', $event)">卖出</button></div>
          <div v-if="!isManual" class="ticket-estimates" role="group" aria-label="订单预估">
            <dl v-if="showBuy" class="ticket-estimate-column" aria-label="买入预估">
              <div><dt>预估数量(股)</dt><dd>{{ estimate.buy > 0 ? number(estimate.buy) : '--' }}</dd></div>
              <div><dt>预估金额({{ symbolCurrency }})</dt><dd>{{ estimate.buyAmount > 0 ? money(estimate.buyAmount) : '--' }}</dd></div>
            </dl>
            <dl v-if="showSell" class="ticket-estimate-column" aria-label="卖出预估">
              <div><dt>预估数量(股)</dt><dd>{{ estimate.sell > 0 ? number(estimate.sell) : '--' }}</dd></div>
              <div><dt>预估金额({{ symbolCurrency }})</dt><dd>{{ estimate.sellAmount > 0 ? money(estimate.sellAmount) : '--' }}</dd></div>
            </dl>
          </div>
          <footer class="ticket-summary-footer">
            <p v-if="fullCapabilities && !assetsCollapsed" class="focus-account-scope">范围：列表所选账户 · {{ (overviewAccountIds.length ? overviewAccountIds : [accountId]).map(id => accounts.find(account => account.id === id)?.name || id).join('、') }}</p>
            <EquityAccountSummary v-model:visible="assetsVisible" v-model:collapsed="assetsCollapsed" :summary="accountOverview" />
          </footer>
        </section>
    </template>
    <EquityAccountPicker v-else-if="page === 'accounts'" :accounts="accounts" :selected-id="accountId" @select="changeAccount" />
    <template v-else-if="page === 'custom'">
      <div class="order-entry-scroll ticket-settings"><label class="app-form-label" for="mobile-custom-name">标的名称</label><input id="mobile-custom-name" v-model="customDraft.name" maxlength="40" placeholder="请输入标的名称"><label class="app-form-label" for="mobile-custom-code">标的代码</label><input id="mobile-custom-code" v-model="customDraft.code" maxlength="24" placeholder="请输入标的代码"><label class="app-form-label" for="mobile-custom-market">所属市场</label><select id="mobile-custom-market" v-model="customDraft.market"><option value="A">A股</option><option value="HK">港股</option><option value="US">美股</option></select><p v-if="error" class="ticket-error" role="alert">{{ error }}</p></div>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="navigate('symbols')">取消</button><button type="button" class="ticket-primary" @click="addManualSymbol">新增标的</button></footer>
    </template>
    <template v-else-if="page === 'confirm' && snapshot">
      <div class="order-entry-scroll ticket-confirm"><h3><span :class="snapshot.side === 'buy' ? 'equity-positive' : 'equity-negative'">{{ snapshot.side === 'buy' ? '买入' : '卖出' }}</span> {{ snapshot.symbol.name }} <small>{{ snapshot.symbol.code }}</small></h3><dl><div><dt>订单价格 ({{ symbolCurrency }})</dt><dd>{{ snapshot.type === 'limit' ? priceText(snapshot.price) : '市价' }}</dd></div><div><dt>{{ isAmend ? '改后订单总数量 (股)' : '订单数量 (股)' }}</dt><dd>{{ number(snapshot.quantity) }}</dd></div><div><dt>{{ isAmend ? '未成交部分预估金额' : '预估金额' }} ({{ symbolCurrency }})</dt><dd>{{ snapshot.price > 0 ? money(snapshot.amount) : '--' }}</dd></div><div><dt>下单账户</dt><dd>{{ accountLabel(snapshot.account) }}</dd></div><div><dt>订单类型</dt><dd>{{ snapshot.execution === 'highTouch' ? '手工单' : '系统单' }}</dd></div><div><dt>执行算法</dt><dd>{{ snapshot.algorithm }}</dd></div><div><dt>订单方式</dt><dd>{{ snapshot.type === 'limit' ? '限价单' : '市价单' }}</dd></div><template v-if="snapshot.algorithm === 'POV'"><div><dt>运行时间</dt><dd>{{ snapshot.pov.hours }} 时 {{ snapshot.pov.minutes }} 分</dd></div><div><dt>市场成交占比</dt><dd>{{ snapshot.pov.participation }}%</dd></div></template><div v-if="snapshot.inputAmount !== null"><dt>订单金额 ({{ symbolCurrency }})</dt><dd>{{ money(snapshot.inputAmount) }}</dd></div><div v-if="snapshot.note"><dt>备注</dt><dd>{{ snapshot.note }}</dd></div></dl></div>
      <div v-if="isAmend" class="ticket-amend-confirm app-numeric">已成 {{ number(snapshot.filled) }} 股不变 · 改后未成交 {{ number(snapshot.remaining) }} 股</div><p v-if="error" class="ticket-error" role="alert">{{ error }}</p>
      <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="back">返回</button><button type="button" class="ticket-primary" :disabled="isPaused" @click="confirmDemo">确认{{ isAmend ? '改单' : snapshot.side === 'buy' ? '买入' : '卖出' }}</button></footer>
    </template>
    <template v-else-if="page === 'done'">
      <div class="order-entry-scroll ticket-complete"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><path d="m14 24 7 7 14-14"/></svg><h3>{{ isAmend ? '改单已完成' : '订单已确认' }}</h3><p v-if="doneMessage">{{ doneMessage }}</p><p v-if="snapshot">{{ snapshot.symbol.name }} · {{ snapshot.side === 'buy' ? '买入' : '卖出' }} {{ number(snapshot.quantity) }} 股</p></div><footer class="ticket-footer ticket-secondary-actions"><button type="button" class="ticket-primary" @click="close">完成</button></footer>
    </template>
  </van-popup>
  <van-popup :show="show && page === 'algorithm'" position="center" round class="equity-order-sheet equity-algorithm-dialog ticket-entry-sheet" :class="{ 'ticket-pov-dialog': design === 'baseline' }" overlay-class="equity-sheet-overlay equity-algorithm-overlay" :overlay-props="{ 'aria-hidden': 'true', tabindex: -1 }" :duration=".2" :aria-label="design === 'baseline' ? 'POV 参数' : '执行算法'" aria-modal="true" @update:show="value => { if (!value) back() }" @opened="algorithmHeading?.focus()" @keydown.stop="handleKeyboard">
    <header class="order-sheet-heading"><h2 ref="algorithmHeading" tabindex="-1">{{ design === 'baseline' ? 'POV 参数' : '执行算法' }}</h2><EquitySheetClose aria-label="关闭执行算法弹窗" @click="back" /></header>
    <div class="order-entry-scroll ticket-settings">
      <van-tabs v-model:active="algorithmDraft.value" type="card" :ellipsis="false" :duration="0" class="ticket-algorithm-tabs" @keydown="handleAlgorithmKeydown">
        <van-tab v-for="option in algorithmDialogOptions" :key="option.value" :name="option.value" :title="option.label">
          <div v-if="option.value === 'POV'" class="ticket-algorithm-params"><label class="app-form-label">运行时间</label><div class="ticket-duration"><label><select v-model="algorithmDraft.hours" aria-label="POV运行小时"><option v-for="hour in 24" :key="hour" :value="hour - 1">{{ String(hour - 1).padStart(2, '0') }}</option></select><span>时</span></label><label><select v-model="algorithmDraft.minutes" aria-label="POV运行分钟"><option v-for="minute in 60" :key="minute" :value="minute - 1">{{ String(minute - 1).padStart(2, '0') }}</option></select><span>分</span></label></div><label class="app-form-label" for="mobile-pov-participation">市场成交占比</label><div class="ticket-participation"><input id="mobile-pov-participation" v-model="algorithmDraft.participation" type="number" inputmode="numeric" min="1" max="25" step="1"><span>%</span></div><p v-if="!validPov(algorithmDraft)" class="ticket-error" role="alert">请填写有效的运行时间和成交占比</p></div>
        </van-tab>
      </van-tabs>
    </div>
    <footer class="ticket-footer ticket-secondary-actions"><button type="button" @click="back">取消</button><button type="button" class="ticket-primary" :disabled="algorithmDraft.value === 'POV' && !validPov(algorithmDraft)" @click="applyAlgorithm">确认配置</button></footer>
  </van-popup>
</template>
