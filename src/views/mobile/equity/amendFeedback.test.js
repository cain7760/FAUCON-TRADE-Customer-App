import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as fixtures from './fixtures.js'
import * as model from './model.js'
import * as orderModel from './orderModel.js'
import * as orderActions from './orderActions.js'
import * as marketRules from './orderMarketRules.js'
import * as decimal from './decimalMath.js'
import * as calculations from './orderCalculations.js'
import { orderAccountOverview } from './accountOverview.js'

function setup(result) {
  const toasts = [], events = []
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'amend-feedback-test' }).content
  const imports = { ...vue, ...fixtures, ...model, ...orderModel, ...orderActions, ...marketRules, ...decimal, ...calculations, orderAccountOverview,
    showSuccessToast: message => toasts.push(message), EquityAccountTrigger: {}, EquitySheetClose: {}, EquitySymbolPicker: {}, EquityOrderBook: {}, EquityAccountPicker: {}, EquityAccountSummary: {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  const record = { ...fixtures.orderInstruments[0], id: 'one', account: 'TZS_T0', orderType: '系统单', type: 'limit', side: 'buy',
    quantity: 1000, filledQuantity: 0, status: '已报', price: 12 }
  const form = component.setup(vue.reactive({ show: true, context: { action: 'amend', record } }),
    { expose() {}, emit(name, ...args) { events.push([name, ...args]); if (name === 'amend') args[1](result) } })
  form.snapshot.value = { symbol: record, type: 'limit', amendment: { orderId: record.id } }
  return { form, toasts, events }
}
test('App 改单成功仅显示全局提示并关闭面板，不进入额外成功页', () => {
  const scope = vue.effectScope(), state = scope.run(() => setup({ message: '本地演示改单完成' }))
  state.form.confirmDemo()
  assert.deepEqual(state.toasts, ['改单提交成功'])
  assert.ok(state.events.some(([name, value]) => name === 'update:show' && value === false))
  assert.notEqual(state.form.page.value, 'done')
  assert.equal(state.events.filter(([name]) => name === 'order').length, 0)
  scope.stop()
})
test('App 改单失败保留面板与错误提示，不显示成功提示', () => {
  const scope = vue.effectScope(), state = scope.run(() => setup({ error: '订单状态已变化' }))
  state.form.confirmDemo()
  assert.deepEqual(state.toasts, [])
  assert.equal(state.form.error.value, '订单状态已变化')
  assert.equal(state.events.some(([name]) => name === 'update:show'), false)
  scope.stop()
})
