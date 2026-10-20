import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as fixtures from './fixtures.js'
import * as model from './model.js'
import * as orderModel from './orderModel.js'
import * as rules from './orderMarketRules.js'

function setup(context) {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'mobile-market-release-test' }).content
  const imports = { ...vue, ...fixtures, ...model, ...orderModel, ...rules }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return component.setup(vue.reactive({ show: true, context }), { expose() {}, emit() {} })
}
const hk = fixtures.orderInstruments.find(row => row.code === '00700')
test('App 港股筛选、新单、追单和平仓均只限价，其他市场保持原有能力', async () => {
  for (const action of ['new', 'chase', 'close']) {
    const scope = vue.effectScope(), form = scope.run(() => setup({ action, record: action === 'new' ? null : { ...hk, account: 'TZS_T0' } }))
    form.market.value = 'HK'
    assert.equal(form.filteredSymbols.value.length, 6)
    form.selectSymbol(hk); await vue.nextTick()
    assert.equal(form.symbolCurrency.value, 'HKD')
    assert.deepEqual(form.priceTypeOptions.value, [['limit', '限价']])
    form.setType('market'); await vue.nextTick()
    assert.equal(form.draft.type, 'limit')
    form.selectSymbol(fixtures.orderInstruments[0]); await vue.nextTick()
    assert.equal(form.priceTypeOptions.value.length, 2)
    assert.equal(form.draft.type, 'limit')
    form.setType('market'); await vue.nextTick()
    assert.equal(form.draft.type, 'market')
    scope.stop()
  }
})
test('App 港股手工标的遵循同一规则，确认也不接受非法市价快照', async () => {
  const scope = vue.effectScope(), form = scope.run(() => setup({ action: 'new' }))
  form.selectSymbol({ ...hk, isManual: true }); form.setType('market'); await vue.nextTick()
  assert.equal(form.draft.type, 'limit')
  form.snapshot.value = { symbol: hk, type: 'market' }; form.confirmDemo()
  assert.match(form.error.value, /港股仅支持限价/)
  assert.notEqual(form.page.value, 'done')
  scope.stop()
})
test('App 下单模型拒绝绕过隐藏按钮提交港股市价单', () => {
  const draft = { type: 'market', price: 320, value: 100, unit: 'shares', mode: 'quantity', fraction: 0, algorithm: 'DMA' }
  const estimate = orderModel.orderEstimates(draft, hk, 1000000, 1000)
  assert.match(orderModel.orderError(draft, hk, estimate, 'buy'), /港股仅支持限价/)
  assert.equal(orderModel.orderError({ ...draft, type: 'limit' }, hk, estimate, 'buy'), '')
})
