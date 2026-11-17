import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as fixtures from './fixtures.js'
import * as model from './model.js'
import * as orderModel from './orderModel.js'
import * as orderActions from './orderActions.js'
import * as rules from './orderMarketRules.js'
import * as decimal from './decimalMath.js'
import * as calculations from './orderCalculations.js'
import { orderAccountOverview } from './accountOverview.js'
import { submitDemoOrder } from './demoLedger.js'

function setup(context, layout = 'stacked', options = {}) {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'mobile-market-test' }).content
  const imports = { ...vue, ...fixtures, ...model, ...orderModel, ...orderActions, ...rules, ...decimal, ...calculations, orderAccountOverview,
    showSuccessToast() {}, document: { addEventListener() {}, removeEventListener() {} }, AppSelectField: {}, EquityAccountTrigger: {}, EquitySheetClose: {}, EquitySymbolPicker: {}, EquityOrderBook: {}, EquityAccountPicker: {}, EquityPovDeadline: {}, EquityAccountSummary: {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return component.setup(vue.reactive({ show: true, context, layout, fullCapabilities: false, systemRunning: true, overviewAccountIds: [], ...options }), { expose() {}, emit: options.emit || (() => {}) })
}
const hk = fixtures.orderInstruments.find(row => row.code === '00700')

test('确认委托只有父层成功回执才进入完成页，失败保留参数与错误', () => {
  const scope = vue.effectScope()
  let respond
  const form = scope.run(() => setup({ action: 'new' }, 'split', { emit: (event, snapshot, callback) => { if (event === 'order') respond = callback } }))
  form.draft.algorithm = 'DMA'; form.draft.value = 100
  form.preview('buy'); form.confirmDemo()
  assert.equal(form.page.value, 'confirm')
  respond({ error: '下单失败，最大可用不足' })
  assert.equal(form.page.value, 'confirm'); assert.equal(form.draft.value, 100)
  assert.equal(form.error.value, '下单失败，最大可用不足')
  form.confirmDemo(); respond({ message: '委托已保存' })
  assert.equal(form.page.value, 'done'); assert.equal(form.doneMessage.value, '委托已保存')
  scope.stop()
})

test('三种展示的新单与追单超最大可买可进入确认，数量和金额订单均由提交层拒绝且保留草稿', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  for (const design of ['baseline', 'focus', 'c']) for (const action of ['new', 'chase']) for (const mode of ['quantity', 'amount']) {
    const orders = structuredClone(fixtures.demoRecords.orders), original = structuredClone(orders)
    let submitted = 0
    const form = scope.run(() => setup({ action, record: action === 'chase' ? fixtures.demoRecords.positions[0] : undefined }, 'split', {
      design, fullCapabilities: design !== 'baseline',
      emit(event, snapshot, respond) {
        if (event !== 'order') return
        submitted++
        try { submitDemoOrder(orders, snapshot); respond({ message: '委托已保存' }) }
        catch (error) { respond({ error: error.message }) }
      },
    }))
    form.draft.algorithm = 'DMA'
    form.setMode(mode)
    form.draft.value = mode === 'quantity' ? 100000 : 1178000
    await vue.nextTick()
    assert.equal(orderModel.canPreviewOrder(form.draft, form.symbol.value, form.estimate.value, 'buy'), true)
    form.preview('buy')
    assert.equal(form.page.value, 'confirm')
    assert.equal(form.snapshot.value.quantity, 100000)
    assert.equal(form.snapshot.value.exceedsMaxBuy, true)
    form.confirmDemo()
    assert.equal(submitted, 1, '警告不得拦截最终提交调用')
    assert.equal(form.page.value, 'confirm')
    assert.equal(form.error.value, '下单失败，最大可用不足')
    assert.equal(form.draft.value, mode === 'quantity' ? 100000 : 1178000)
    assert.deepEqual(orders, original, '拒绝不插入订单或占用资金')
  }
})

test('买入警告随重新预览更新，卖出容量与整手限制保持不变', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const form = scope.run(() => setup({ action: 'new' }))
  form.draft.algorithm = 'DMA'; form.draft.value = 100000
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.snapshot.value.exceedsMaxBuy, true)
  form.back(); form.draft.value = form.estimate.value.maxBuy
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.page.value, 'confirm')
  assert.equal(form.snapshot.value.exceedsMaxBuy, false, '恰好等于最大可买不警告')
  form.back(); form.draft.value = form.estimate.value.maxSell + 100
  await vue.nextTick()
  form.preview('sell')
  assert.equal(form.page.value, 'form')
  assert.match(form.error.value, /超出最大可卖/)
  form.draft.value = 100001
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.page.value, 'form')
  assert.match(form.error.value, /整数倍/)
})

test('预览警告不决定成交结果，提交时资金充足仍可成功', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const orders = structuredClone(fixtures.demoRecords.orders), count = orders.length
  const form = scope.run(() => setup({ action: 'new' }, 'split', {
    accountCash: { TZS_T0: 0 },
    emit(event, snapshot, respond) {
      if (event !== 'order') return
      submitDemoOrder(orders, snapshot)
      respond({ message: '委托已保存' })
    },
  }))
  form.draft.algorithm = 'DMA'; form.draft.value = 100
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.snapshot.value.exceedsMaxBuy, true)
  form.confirmDemo()
  assert.equal(form.page.value, 'done')
  assert.equal(orders.length, count + 1)
})

test('DMA直接应用，POV和TWAP及VWAP确认保存并支持取消', async () => {
 const scope = vue.effectScope()
 const form = scope.run(() => setup({action:'new'}, 'split', {design:'baseline'}))
 form.selectAlgorithm('DMA')
 for (const algorithm of ['POV','TWAP','VWAP']) {
  form.selectAlgorithm(algorithm)
  assert.equal(form.page.value, 'algorithm')
  form.algorithmDraft.executionTime = ['13:00','14:00']
  form.algorithmDraft.participation = 20
  form.back()
  assert.equal(form.draft.algorithm, 'DMA')
  form.selectAlgorithm(algorithm)
  assert.deepEqual(form.algorithmDraft.executionTime, form.draft.pov.executionTime || ['', ''])
  form.algorithmDraft.executionTime = ['13:00','14:00']
  form.applyAlgorithm()
  assert.equal(form.draft.algorithm, algorithm)
  assert.deepEqual(form.draft.pov.executionTime, ['13:00','14:00'])
  form.selectAlgorithm('DMA')
 }
 scope.stop()
})

test('单位菜单保持数量切换、同项重选、金额换算的原规则', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const form = scope.run(() => setup({ action: 'new' }, 'split'))
  form.draft.value = 1200
  form.selectUnit('shares')
  assert.equal(form.draft.value, 1200, '重选当前单位不清空输入')
  form.selectUnit('wan')
  assert.equal(form.quantityUnit.value, 'wan')
  assert.equal(form.draft.value, '', '保留基线切换数量单位时重置的规则')
  assert.equal(form.selectedUnitLabel.value, '万股')
  form.setMode('amount'); form.displayValue.value = 12000
  form.selectUnit('wan')
  assert.equal(form.draft.value, 12000)
  assert.equal(form.displayValue.value, 1.2)
  assert.equal(form.selectedUnitLabel.value, '万元')
  form.selectUnit('yuan')
  assert.equal(form.displayValue.value, 12000)
  form.unitMenuOpen.value = true
  form.selectFraction(50)
  await vue.nextTick()
  assert.equal(form.unitMenuOpen.value, false, '比例模式下菜单关闭，仍显示百分比单位')
})

test('单位菜单支持方向键、Esc仅收起菜单并恢复焦点', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const form = scope.run(() => setup({ action: 'new' }))
  let focused = null, stopped = 0
  const options = [0, 1].map(index => ({ focus() { focused = index } }))
  form.unitOptionsElement.value = { querySelectorAll: () => options }
  form.unitTrigger.value = { focus() { focused = 'trigger' } }
  const event = { key: 'ArrowDown', target: options[0], preventDefault() {}, stopPropagation() { stopped++ } }
  form.handleUnitKeyboard(event)
  assert.equal(focused, 1)
  form.handleUnitKeyboard({ ...event, key: 'Home', target: options[1] })
  assert.equal(focused, 0)
  form.unitMenuOpen.value = true
  form.handleUnitKeyboard({ ...event, key: 'Escape' })
  await vue.nextTick()
  assert.equal(form.unitMenuOpen.value, false)
  assert.equal(focused, 'trigger')
  assert.equal(form.page.value, 'form')
  assert.equal(stopped, 3)
})

test('金额改单回填完整预算，保留实际已成金额且不重复累加数量', async () => {
  const scope = vue.effectScope()
  const record = { ...fixtures.orderInstruments[0], id: 'amend-amount-parity', account: 'TZS_T0', orderType: '系统单', type: 'limit', price: 11.78, quantity: 10000, inputAmount: 117850, filledQuantity: 2000, side: 'sell', status: '部成', algorithm: 'DMA' }
  const form = scope.run(() => setup({ action: 'amend', record }, 'split', { fullCapabilities: true }))
  assert.equal(form.displayValue.value, 117850)
  form.preview('sell')
  assert.equal(form.error.value, '请先修改订单参数')
  form.draft.price = 12; await vue.nextTick()
  assert.equal(form.amendmentTotalAmount.value, 117850)
  assert.equal(form.displayValue.value, 117850)
  assert.equal(form.estimate.value.sell, 9800)
  form.preview('sell')
  assert.equal(form.snapshot.value.inputAmount, 117850)
  assert.equal(form.snapshot.value.quantity, 9800)
  form.back(); form.draft.amountUnit = 'wan'
  assert.equal(form.displayValue.value, 11.785)
  form.sizeInputValue.value = 6
  assert.equal(form.amendmentTotalAmount.value, 60000)
  assert.equal(form.estimate.value.sell, 5000)
  form.setMode('quantity'); assert.equal(form.draft.value, 10000)
  form.setMode('amount'); assert.equal(form.displayValue.value, 6)
  form.draft.price = 13; await vue.nextTick()
  assert.equal(form.displayValue.value, 6)
  scope.stop()
})

test('新版买单改单继承 PC 仅卖方容量校验，基线继续使用原买方校验', () => {
  const scope = vue.effectScope()
  const record = { ...fixtures.orderInstruments[0], id: 'amend-buy-parity', account: 'TZS_T0', orderType: '系统单', type: 'limit', price: 11.78, quantity: 10000, filledQuantity: 0, side: 'buy', status: '已报', algorithm: 'DMA' }
  const focus = scope.run(() => setup({ action: 'amend', record }, 'split', { fullCapabilities: true }))
  focus.sizeInputValue.value = 100000
  assert.equal(focus.estimate.value.maxBuy, 80200)
  focus.preview('buy')
  assert.equal(focus.error.value, '')
  assert.equal(focus.snapshot.value.quantity, 100000)
  const baseline = scope.run(() => setup({ action: 'amend', record }))
  baseline.sizeInputValue.value = 100000; baseline.preview('buy')
  assert.match(baseline.error.value, /超出最大可买/)
  const sell = scope.run(() => setup({ action: 'amend', record: { ...record, side: 'sell' } }, 'split', { fullCapabilities: true }))
  sell.sizeInputValue.value = 10100; sell.preview('sell')
  assert.match(sell.error.value, /超出最大可卖/)
  scope.stop()
})

test('无成交金额改单在两种展示中都保留提交预算，不丢弃整手后的余量', () => {
  const record = { ...fixtures.orderInstruments[0], id: 'amend-amount-retain', account: 'TZS_T0', orderType: '系统单', type: 'limit', price: 11.78, quantity: 10000, inputAmount: 117850, filledQuantity: 0, side: 'sell', status: '已报', algorithm: 'DMA' }
  const payload = { type: 'limit', price: 12, quantity: 9800, inputAmount: 117850, algorithm: 'DMA', note: '' }
  const focusOrders = [{ ...record }], baselineOrders = [{ ...record }]
  orderActions.applyDemoOrderAction(focusOrders, record.id, 'amend', payload, new Date('2026-10-22T01:00:00Z'), { pcParity: true })
  orderActions.applyDemoOrderAction(baselineOrders, record.id, 'amend', payload, new Date('2026-10-22T01:00:00Z'))
  assert.equal(focusOrders[0].inputAmount, 117850)
  assert.equal(focusOrders[0].orderValueNumber, 117850)
  assert.equal(baselineOrders[0].inputAmount, 117850)
})

test('新版改单输入和滑块按订单总量，提交不叠加已成数量', async () => {
  const scope = vue.effectScope()
  const record = { ...fixtures.orderInstruments[0], id: 'amend-parity', account: 'TZS_T0', orderType: '系统单', type: 'limit', price: 11.78, quantity: 10000, filledQuantity: 2000, side: 'sell', status: '部成', algorithm: 'DMA' }
  const form = scope.run(() => setup({ action: 'amend', record }, 'split', { fullCapabilities: true }))
  assert.equal(form.draft.value, 10000)
  assert.equal(form.estimate.value.sell, 10000)
  assert.equal(form.estimate.value.maxSell, 10000)
  form.selectFraction(50); await vue.nextTick()
  assert.equal(form.draft.mode, 'quantity')
  assert.equal(form.draft.value, 5000)
  assert.equal(form.showsFraction.value, false)
  form.draft.price = 12; await vue.nextTick()
  assert.equal(form.draft.value, 5000)
  assert.equal(form.estimate.value.sell, 5000)
  assert.equal(form.draft.fraction, 50)
  form.setMode('amount'); form.selectFraction(50); await vue.nextTick()
  assert.equal(form.draft.mode, 'amount')
  assert.equal(form.draft.value, 59560)
  assert.equal(form.estimate.value.sell, 5000)
  form.preview('sell')
  assert.equal(form.snapshot.value.quantity, 5000)
  assert.equal(form.snapshot.value.inputAmount, 59560)
  assert.equal(form.snapshot.value.filled, 2000)
  scope.stop()
})

test('新版改单万股支持两位小数，换单位保留实际股数且能预览；基线仍清空', async () => {
  const scope = vue.effectScope()
  const record = { ...fixtures.orderInstruments[0], id: 'amend-unit', account: 'TZS_T0', orderType: '系统单', type: 'limit', price: 11.78, quantity: 10000, filledQuantity: 2000, side: 'sell', status: '部成', algorithm: 'DMA' }
  const form = scope.run(() => setup({ action: 'amend', record }, 'split', { fullCapabilities: true }))
  form.quantityUnit.value = 'wan'; form.changeQuantityUnit(); await vue.nextTick()
  assert.equal(form.draft.value, 1)
  assert.equal(form.estimate.value.sell, 10000)
  form.sizeInputValue.value = .31; form.normalizeSize(); await vue.nextTick()
  assert.equal(form.draft.value, .31)
  assert.equal(form.estimate.value.sell, 3100)
  assert.equal(form.draft.fraction, 31)
  form.preview('sell')
  assert.equal(form.error.value, '')
  assert.equal(form.snapshot.value.quantity, 3100)
  form.back(); form.selectFraction(50); await vue.nextTick()
  assert.equal(form.draft.value, .5)
  assert.equal(form.estimate.value.sell, 5000)
  form.quantityUnit.value = 'shares'; form.changeQuantityUnit(); await vue.nextTick()
  assert.equal(form.draft.value, 5000)
  const baseline = scope.run(() => setup({ action: 'amend', record }))
  baseline.quantityUnit.value = 'wan'; baseline.changeQuantityUnit()
  assert.equal(baseline.draft.value, '')
  scope.stop()
})

test('新版持仓点下单继承明确执行类型和账户标的，不从来源标签推断委托类型', () => {
  const scope = vue.effectScope()
  const position = fixtures.demoRecords.positions.find(row => row.account === 'TZS_T1' && row.code === '300008')
  for (const [fields, execution] of [
    [{ executionType: 'highTouch' }, 'highTouch'],
    [{ orderType: '手工单' }, 'highTouch'],
    [{ executionType: 'lowTouch', orderType: '手工单' }, 'lowTouch'],
    [{ sourceOrderTypes: ['手工单'] }, 'lowTouch'],
    [{ sourceOrderTypes: ['系统单', '手工单'] }, 'lowTouch'],
  ]) {
    const record = { ...position, ...fields }
    const form = scope.run(() => setup({ action: 'new', record }, 'split', { fullCapabilities: true }))
    assert.equal(form.draft.execution, execution)
    assert.equal(form.accountId.value, record.account)
    assert.equal(form.symbol.value.code, record.code)
    assert.equal(form.isLocked.value, false)
    assert.equal(form.draft.type, 'limit')
    assert.equal(form.draft.value, '')
  }
  const baseline = scope.run(() => setup({ action: 'new', record: { ...position, executionType: 'highTouch', orderType: '手工单' } }))
  assert.equal(baseline.draft.execution, 'lowTouch')
  scope.stop()
})

test('新版比例订单按当前 PC 的买卖各自容量估算，金额/万股输入不污染比例', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }, 'split', { fullCapabilities: true }))
  for (const [mode, unit, value] of [['quantity', 'shares', 1000], ['quantity', 'wan', 2], ['amount', 'shares', 10000]]) {
    form.setMode(mode); form.draft.unit = unit; form.draft.value = value
    await vue.nextTick()
    form.selectFraction(44)
    assert.equal(form.draft.mode, 'percentage')
    assert.equal(form.sizeInputValue.value, '44%')
    assert.equal(form.usesAmount.value, false)
    assert.equal(form.estimate.value.buy, 35200)
    assert.equal(form.estimate.value.sell, 4000)
    assert.equal(form.estimate.value.buyAmount, 414656)
    assert.equal(form.estimate.value.sellAmount, 47120)
    form.preview('sell')
    assert.equal(form.snapshot.value.quantity, 4000)
    assert.equal(form.snapshot.value.inputAmount, null)
    form.back()
  }
  form.selectFraction(100)
  assert.equal(form.estimate.value.buy, 80200)
  assert.equal(form.estimate.value.sell, 9300)
  form.selectFraction(0)
  assert.equal(form.estimate.value.buy, 0)
  assert.equal(form.estimate.value.sell, 0)
  scope.stop()
})

test('新版比例价变及限价点价保留比例，点击输入切为股数并归零', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }, 'split', { fullCapabilities: true }))
  form.draft.unit = 'wan'; form.selectFraction(50)
  form.setType('limit')
  assert.equal(form.draft.mode, 'percentage')
  assert.equal(form.showsFraction.value, true)
  form.draft.price = 12; await vue.nextTick()
  assert.equal(form.draft.fraction, 50)
  assert.equal(form.estimate.value.buy, 39300)
  assert.equal(form.estimate.value.sell, 4600)
  form.setBookPrice(11.78); await vue.nextTick()
  assert.equal(form.draft.fraction, 50)
  assert.equal(form.showsFraction.value, true)
  form.editSize(); await vue.nextTick()
  assert.equal(form.draft.mode, 'quantity')
  assert.equal(form.draft.unit, 'shares')
  assert.equal(form.draft.value, 0)
  assert.equal(form.draft.fraction, 0)
  form.sizeInputValue.value = 900
  assert.equal(form.estimate.value.buy, 900)
  assert.equal(form.estimate.value.sell, 900)
  form.selectFraction(50); form.setType('market'); await vue.nextTick()
  assert.equal(form.draft.mode, 'quantity')
  assert.equal(form.showsFraction.value, false)
  assert.equal(form.draft.value, '')
  form.selectFraction(50); form.changeAccount('TZS_T1'); await vue.nextTick()
  assert.equal(form.draft.mode, 'quantity')
  assert.equal(form.draft.fraction, 0)
  scope.stop()
})

test('新版平仓手工数量反映可卖比例，比例模式保留卖出容量计算', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'close', record: fixtures.demoRecords.positions[0] }, 'split', { fullCapabilities: true }))
  form.sizeInputValue.value = 3000; await vue.nextTick()
  assert.equal(form.draft.fraction, 3000 / 9300 * 100)
  form.setMode('amount'); form.sizeInputValue.value = 11780; await vue.nextTick()
  assert.equal(form.draft.fraction, 1000 / 9300 * 100)
  form.selectFraction(50)
  assert.equal(form.estimate.value.sell, 4600)
  form.draft.price = 12; await vue.nextTick()
  assert.equal(form.draft.fraction, 50)
  assert.equal(form.estimate.value.sell, 4600)
  scope.stop()
})

test('新版资产概要按列表多选账户汇总，切换交易账户不改变概要范围', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }, 'split', { fullCapabilities: true, overviewAccountIds: ['TZS_T0', 'TZS_T1'] }))
  const summary = form.accountOverview.value
  assert.deepEqual(summary, { available: 1566327.41, marketValue: 11359861, floatingProfit: 78036 })
  form.changeAccount('TZS_T1'); await vue.nextTick()
  assert.deepEqual(form.accountOverview.value, summary)
  form.props.overviewAccountIds = ['TZS_T1']
  assert.deepEqual(form.accountOverview.value, orderAccountOverview('TZS_T1', fixtures.demoRecords.positions))
  scope.stop()
})

test('新版暂停在预览和确认两处拦截，确认前暂停不生成订单；旧基线不受新开关影响', () => {
  const scope = vue.effectScope(), events = []
  const form = scope.run(() => setup({ action: 'new' }, 'split', { fullCapabilities: true, systemRunning: false, emit: (...args) => events.push(args) }))
  form.draft.value = 900
  form.preview('buy')
  assert.equal(form.snapshot.value, null)
  assert.match(form.error.value, /系统暂停交易/)
  form.props.systemRunning = true
  form.preview('buy')
  assert.equal(form.page.value, 'confirm')
  form.props.systemRunning = false
  form.confirmDemo()
  assert.equal(events.filter(([name]) => name === 'order').length, 0)
  assert.equal(form.page.value, 'confirm')
  form.props.systemRunning = true
  form.confirmDemo()
  assert.equal(events.filter(([name]) => name === 'order').length, 1)
  const baseline = scope.run(() => setup({ action: 'new' }, 'split', { systemRunning: false }))
  assert.equal(baseline.isPaused.value, false)
  scope.stop()
})

test('方案 A/B 共用交易逻辑，比例、单位、账户和算法计算相同', () => {
  const scope = vue.effectScope()
  const forms = ['stacked', 'split'].map(layout => scope.run(() => setup({ action: 'new' }, layout)))
  for (const form of forms) form.selectFraction(44)
  assert.deepEqual(forms[0].estimate.value, forms[1].estimate.value)
  assert.equal(forms[1].draft.value, 35200)
  for (const form of forms) { form.setMode('amount'); form.draft.amountUnit = 'wan'; form.selectFraction(65) }
  assert.equal(forms[0].displayValue.value, forms[1].displayValue.value)
  assert.deepEqual(forms[0].estimate.value, forms[1].estimate.value)
  assert.equal(forms[0].accountId.value, forms[1].accountId.value)
  assert.equal(forms[0].draft.algorithm, forms[1].draft.algorithm)
  scope.stop()
})

test('比例滑块回填真实数量，买卖共用同一输入且不切换百分比模式', () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  form.selectFraction(25)
  assert.equal(form.estimate.value.buy, 20000)
  assert.equal(form.estimate.value.sell, 20000)
  assert.equal(form.draft.value, 20000)
  assert.equal(form.draft.mode, 'quantity')
  form.selectFraction('65')
  assert.equal(form.draft.fraction, 65)
  assert.equal(form.estimate.value.buy, 52100)
  assert.equal(form.estimate.value.sell, 52100)
  form.selectFraction(100)
  assert.equal(form.estimate.value.buy, form.estimate.value.maxBuy)
  assert.equal(form.estimate.value.sell, form.estimate.value.maxBuy)
  form.selectFraction(0)
  assert.equal(form.estimate.value.buy, 0)
  assert.equal(form.estimate.value.sell, 0)
  form.setMode('amount')
  assert.equal(form.draft.fraction, 0)
  form.clearSymbol()
  assert.equal(form.draft.fraction, 0)
  scope.stop()
})

test('A/B 滑块显示百分比，点击编辑恢复实际数量及原单位，不把比例当股数', async () => {
  const scope = vue.effectScope()
  for (const layout of ['stacked', 'split']) {
    const form = scope.run(() => setup({ action: 'new' }, layout))
    form.selectFraction(44)
    assert.equal(form.showsFraction.value, true)
    assert.equal(form.sizeInputValue.value, '44%')
    assert.equal(form.draft.mode, 'quantity')
    assert.equal(form.draft.value, 35200)
    form.normalizeSize()
    assert.equal(form.draft.value, 35200)
    form.editSize(); await vue.nextTick()
    assert.equal(form.showsFraction.value, false)
    assert.equal(form.sizeInputValue.value, 35200)
    form.sizeInputValue.value = 3000
    assert.equal(form.draft.value, 3000)
    assert.equal(form.draft.fraction, 0)
    form.setMode('amount'); form.draft.amountUnit = 'wan'
    form.selectFraction(65)
    assert.equal(form.sizeInputValue.value, '65%')
    assert.equal(form.draft.amountUnit, 'wan')
    const amount = form.draft.value
    form.normalizeSize()
    assert.equal(form.draft.value, amount)
    form.editSize(); await vue.nextTick()
    assert.equal(form.sizeInputValue.value, amount / 10000)
    assert.equal(form.draft.amountUnit, 'wan')
  }
  scope.stop()
})

test('比例展示覆盖零值和满额，点价、价格变化、模式切换及清空恢复实际单位', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  for (const fraction of [0, 100]) {
    form.selectFraction(fraction)
    assert.equal(form.showsFraction.value, true)
    assert.equal(form.sizeInputValue.value, `${fraction}%`)
    assert.equal(form.estimate.value.buy, fraction ? form.estimate.value.maxBuy : 0)
  }
  form.setBookPrice(11.78)
  assert.equal(form.showsFraction.value, false)
  assert.equal(form.draft.fraction, 0)
  form.selectFraction(65); form.draft.price = 12; await vue.nextTick()
  assert.equal(form.showsFraction.value, false)
  form.selectFraction(65); form.setMode('quantity')
  assert.equal(form.showsFraction.value, false)
  form.selectFraction(65); form.clearSymbol()
  assert.equal(form.showsFraction.value, false)
  assert.equal(form.sizeInputValue.value, '')
  scope.stop()
})

test('滑块数量及金额沿用 Customer 口径，万股换算保留实际股数', async () => {
  const { descriptor } = parse(readFileSync(new URL('../../equity/components/OrderTicket.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'customer-slider-parity' }).content
  const imports = { ...vue, money: value => model.formatNumber(value, 2), number: value => model.formatNumber(value, 0), ArrowDown: {}, ArrowUp: {}, CircleClose: {}, InfoFilled: {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  const scope = vue.effectScope()
  const form = scope.run(() => setup({ action: 'new' }))
  const customer = scope.run(() => component.setup(vue.reactive({ symbol: { ...fixtures.orderInstruments[0], available: 9300 }, account: { cash: orderModel.demoOrderCash.TZS_T0 }, instruments: fixtures.orderInstruments, accounts: fixtures.accounts }), { expose() {}, emit() {} }))
  for (const [mode, unit, amountUnit, fraction] of [['quantity', 'shares', 'yuan', 44], ['quantity', 'wan', 'yuan', 65], ['amount', 'shares', 'yuan', 44], ['amount', 'shares', 'wan', 44]]) {
    form.setMode(mode); form.draft.unit = unit; form.draft.amountUnit = amountUnit
    customer.quantityMode.value = mode; customer.unit.value = unit; customer.amountUnit.value = amountUnit
    await vue.nextTick()
    customer.size(fraction); form.selectFraction(fraction)
    assert.equal(form.draft.mode, mode)
    if (mode === 'quantity' && unit === 'wan') {
      assert.equal(form.displayValue.value, 5.21)
      assert.equal(form.estimate.value.buy, 52100)
      assert.equal(form.estimate.value.sell, 52100)
    } else {
      assert.equal(form.displayValue.value, mode === 'amount' ? customer.displayedAmount.value : customer.quantity.value)
      assert.equal(form.estimate.value.buy, customer.shares.value)
      assert.equal(form.estimate.value.sell, customer.shares.value)
    }
    assert.equal(form.draft.fraction, fraction)
  }
  scope.stop()
})

test('平仓仍按可卖容量回填，手动编辑和价格改变重置比例但不清空数量', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'close', record: fixtures.demoRecords.positions[0] }))
  form.selectFraction(44)
  assert.equal(form.draft.value, 4000)
  assert.equal(form.draft.fraction, 44)
  await vue.nextTick()
  assert.equal(form.draft.fraction, 44)
  form.normalizeSize()
  assert.equal(form.draft.fraction, 44)
  form.displayValue.value = 3000
  assert.equal(form.draft.fraction, 0)
  form.selectFraction(50)
  form.draft.price = 12
  await vue.nextTick()
  assert.equal(form.draft.fraction, 0)
  assert.equal(form.draft.value, 4600)
  scope.stop()
})

test('币种、每手股数及 IA 跟随标的，清空或缺少参数不沿用旧值', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  assert.equal(form.symbolCurrency.value, 'CNY')
  assert.equal(form.symbolIaLabel.value, '40% IA')
  form.clearSymbol(); await vue.nextTick()
  assert.equal(form.symbol.value, null)
  assert.equal(form.symbolCurrency.value, '--')
  assert.equal(form.symbolIaLabel.value, '--')
  form.selectSymbol(hk); await vue.nextTick()
  assert.equal(form.symbolCurrency.value, 'HKD')
  assert.equal(form.symbolIaLabel.value, `${hk.iaRate}% IA`)
  form.manualSymbol.value = { code: 'CUSTOM', market: 'US', currency: 'USD', lotSize: 10, iaRate: 25 }
  assert.equal(form.symbolCurrency.value, 'USD')
  assert.equal(form.symbolIaLabel.value, '25% IA')
  assert.equal(form.estimate.value.lot, 10)
  form.selectSymbol({ code: 'MANUAL', name: '手动标的', market: 'HK', isManual: true }); await vue.nextTick()
  assert.equal(form.symbolCurrency.value, 'HKD')
  assert.equal(form.symbolIaLabel.value, '--')
  scope.stop()
})

test('每次打开概要默认收起，切换子页面或账户保留用户展开及资金隐藏选择', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  assert.equal(form.assetsCollapsed.value, true)
  form.assetsCollapsed.value = false
  form.assetsVisible.value = false
  form.navigate('accounts'); form.changeAccount('TZS_T1'); await vue.nextTick()
  assert.equal(form.assetsCollapsed.value, false)
  assert.equal(form.assetsVisible.value, false)
  form.navigate('algorithm'); form.back(); await vue.nextTick()
  assert.equal(form.assetsCollapsed.value, false)
  form.initialize(); await vue.nextTick()
  assert.equal(form.assetsCollapsed.value, true)
  assert.equal(form.assetsVisible.value, false)
  scope.stop()
})

test('移除数量加减不改变股、万股、金额单位与比例的计算规则', () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  form.draft.value = 1000
  assert.equal(form.estimate.value.buy, 1000)
  form.draft.unit = 'wan'
  form.draft.value = 1
  assert.equal(form.estimate.value.buy, 10000)
  form.setMode('amount')
  form.draft.amountUnit = 'wan'
  form.displayValue.value = .01
  assert.equal(form.displayValue.value, .01)
  assert.equal(form.draft.value, 100)
  form.selectFraction(50)
  assert.equal(form.estimate.value.buy, form.estimate.value.sell)
  form.setMode('quantity')
  assert.equal(form.draft.mode, 'quantity')
  assert.equal(form.draft.value, '')
  assert.equal(form.draft.fraction, 0)
  form.clearSymbol()
  assert.equal(form.draft.value, '')
  assert.equal(form.hasReferenceQuote.value, false)
  scope.stop()
})

test('算法参数取消丢弃临时起止时间和成交占比', () => {
 const scope = vue.effectScope()
 const form = scope.run(() => setup({action:'new'}))
 form.draft.algorithm = 'TWAP';form.draft.value = 900
 form.navigate('algorithm')
 form.algorithmDraft.executionTime = ['11:00','12:00'];form.algorithmDraft.participation = 20
 form.back()
 assert.equal(form.draft.pov.participation, 25)
 assert.equal(form.draft.value, 900)
 form.navigate('algorithm')
 assert.deepEqual(form.algorithmDraft.executionTime, ['', ''])
 scope.stop()
})

test('算法弹窗无效POV不能保存，Escape只取消弹窗且保留草稿', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  Object.assign(form.draft, { algorithm: 'POV', value: 900 })
  form.navigate('algorithm')
  Object.assign(form.algorithmDraft, { hours: 0, minutes: 0, participation: 26 })
  form.applyAlgorithm()
  assert.equal(form.page.value, 'algorithm')
  assert.equal(form.draft.pov.participation, 25)
  let prevented = false
  form.handleKeyboard({ key: 'Escape', preventDefault() { prevented = true } })
  await vue.nextTick()
  assert.equal(prevented, true)
  assert.equal(form.page.value, 'form')
  assert.equal(form.draft.value, 900)
  scope.stop()
})

test('共用算法弹窗不改下单、追单、平仓和改单的底层标题', () => {
  const record = { ...fixtures.orderInstruments[0], account: 'TZS_T0', orderType: '系统单', type: 'limit', price: 11.78, quantity: 900, filledQuantity: 0, side: 'buy', status: '已报' }
  for (const [action, expected] of [['new', '下单'], ['chase', '追单'], ['close', '平仓'], ['amend', '改单']]) {
    const scope = vue.effectScope(), form = scope.run(() => setup({ action, record: action === 'new' ? undefined : record }))
    form.navigate('algorithm')
    assert.equal(form.title.value, expected)
    scope.stop()
  }
})

test('本期隐藏类型切换，新单及持仓操作每次打开均恢复系统单', async () => {
  for (const action of ['new', 'chase', 'close']) {
    const scope = vue.effectScope()
    const form = scope.run(() => setup({ action, record: action === 'new' ? undefined : fixtures.demoRecords.positions[0] }))
    assert.equal(vue.unref(form.isExecutionSwitchVisible), false, action)
    assert.equal(form.draft.execution, 'lowTouch', action)
    form.changeExecution('highTouch')
    form.initialize()
    await vue.nextTick()
    assert.equal(form.draft.execution, 'lowTouch', action)
    assert.equal(form.isManual.value, false, action)
    scope.stop()
  }
})
test('App 新单切换港股会清除市价状态，回切A股不自动恢复市价', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  form.setType('market'); await vue.nextTick()
  form.selectSymbol(hk); await vue.nextTick()
  assert.equal(form.draft.type, 'limit')
  assert.deepEqual(form.priceTypeOptions.value, [['limit', '限价']])
  form.selectSymbol(fixtures.orderInstruments[0]); await vue.nextTick()
  assert.equal(form.draft.type, 'limit'); assert.equal(form.priceTypeOptions.value.length, 2)
  form.selectSymbol({ ...hk, isManual: true }); await vue.nextTick()
  form.setType('market'); await vue.nextTick()
  assert.equal(form.draft.type, 'limit'); assert.equal(form.priceTypeOptions.value.length, 1)
  scope.stop()
})
test('App 追单、平仓、改单共用面板均不显示港股市价选项', async () => {
  for (const action of ['chase', 'close', 'amend']) {
    const scope = vue.effectScope()
    const record = { ...hk, account: 'TZS_T0', orderType: '系统单', type: 'market', price: null, quantity: 100, filledQuantity: 0, side: 'buy', status: '已报' }
    const form = scope.run(() => setup({ action, record }))
    await vue.nextTick()
    assert.equal(form.draft.type, 'limit', action)
    assert.deepEqual(form.priceTypeOptions.value, [['limit', '限价']], action)
    scope.stop()
  }
})


test('可选时间允许留空，时间倒序与非法成交占比阻止保存', () => {
 const scope = vue.effectScope()
 const form = scope.run(() => setup({action:'new'}))
 form.selectAlgorithm('VWAP')
 form.algorithmDraft.executionTime = ['14:00','13:00'];form.applyAlgorithm()
 assert.equal(form.page.value, 'algorithm')
 form.algorithmDraft.executionTime = ['', ''];form.algorithmDraft.participation = 26;form.applyAlgorithm()
 assert.equal(form.page.value, 'algorithm')
 form.algorithmDraft.participation = 20;form.applyAlgorithm()
 assert.equal(form.page.value, 'form')
 assert.equal(form.draft.algorithm, 'VWAP')
 scope.stop()
})
