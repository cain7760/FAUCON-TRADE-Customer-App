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
import { orderAccountOverview } from './accountOverview.js'

function setup(context) {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'mobile-market-test' }).content
  const imports = { ...vue, ...fixtures, ...model, ...orderModel, ...orderActions, ...rules, orderAccountOverview,
    showSuccessToast() {}, EquitySymbolPicker: {}, EquityOrderBook: {}, EquityAccountPicker: {}, EquityAccountSummary: {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return component.setup(vue.reactive({ show: true, context }), { expose() {}, emit() {} })
}
const hk = fixtures.orderInstruments.find(row => row.code === '00700')
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
