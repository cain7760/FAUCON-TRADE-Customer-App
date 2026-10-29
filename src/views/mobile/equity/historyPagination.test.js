import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as model from './model.js'
import * as history from './equityHistory.js'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
function setupHistory(record) {
  const { descriptor } = parse(read('./EquityFocusHistory.vue'))
  const script = compileScript(descriptor, { id: 'history-pagination' }).content
  const imports = { ...vue, ...model, ...history, EquitySheetClose: {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  const props = vue.reactive({ show: true, kind: 'orders', record })
  return { props, state: component.setup(props, { expose() {}, emit() {} }) }
}
const events = count => Array.from({ length: count }, (_, i) => ({ time: `2026-10-27 10:${String(i).padStart(2, '0')}:00`, content: `记录${i}` }))

test('操作历史分页不丢记录，尾页/缩小数据/切记录/刷新均保持有效页码', async () => {
  const scope = vue.effectScope()
  const { props, state } = scope.run(() => setupHistory({ id: 'first', history: events(21) }))
  assert.equal(state.pageCount.value, 3)
  const all = []
  for (const page of [1, 2, 3]) {
    state.page.value = page
    all.push(...state.pagedRecords.value)
    assert.equal(state.pagedRecords.value.length, page === 3 ? 1 : 10)
  }
  assert.deepEqual(all, state.records.value)
  props.record.history = events(11)
  await vue.nextTick()
  assert.equal(state.page.value, 2)
  assert.equal(state.pagedRecords.value.length, 1)
  props.record = { id: 'second', history: events(21) }
  await vue.nextTick()
  assert.equal(state.page.value, 1)
  state.page.value = 3
  state.refreshHistory()
  assert.equal(state.page.value, 1)
  assert.equal(state.records.value.length, 21)
  props.record = null
  await vue.nextTick()
  assert.equal(state.pageCount.value, 1)
  assert.equal(state.page.value, 1)
  assert.deepEqual(state.pagedRecords.value, [])
  scope.stop()
})

test('两处历史使用统一 Vant 简洁分页，单页隐藏，无每页条数选择', () => {
  for (const [file, count] of [['./EquityFocusHistory.vue', 'pageCount'], ['./EquityHistoricalData.vue', 'pages']]) {
    const source = read(file)
    assert.ok(source.includes(`v-if="${count} > 1"`))
    assert.match(source, /<van-pagination[^>]*mode="simple"[^>]*class="equity-pagination"/)
    assert.doesNotMatch(source, /<select|条\/页/)
  }
  const plugin = read('../../../plugins/vant.js')
  assert.match(plugin, /\.use\(Pagination\)/)
  assert.match(plugin, /vant\/es\/pagination\/style/)
})
