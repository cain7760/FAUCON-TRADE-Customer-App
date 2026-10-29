import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as model from './model.js'
import { demoRecords, focusPositions } from './fixtures.js'

const { descriptor } = parse(readFileSync(new URL('./EquityDetail.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'focus-detail-test' }).content
const imports = { ...vue, ...model, EquitySheetClose: {}, EquityOrderStatus: {}, showAppMessage() {} }
const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
const fieldsOf = sections => sections.flatMap(section => section.fields)
const sortedFields = fields => fields.toSorted((left, right) => left.key.localeCompare(right.key))
const cases = [
  { kind: 'positions', records: focusPositions, keys: ['floatingProfit', 'value', 'qty', 'available', 'price', 'opening'] },
  { kind: 'orders', records: demoRecords.orders, keys: ['status', 'price', 'quantity', 'filledQuantity', 'filledPrice', 'fillProgress'] },
  { kind: 'trades', records: demoRecords.trades, keys: ['filledPrice', 'filledQuantity', 'filledAmount', 'filledTime'] },
]

for (const { kind, records, keys } of cases) {
  test(`${kind} 优先详情展示核心 ${keys.length} 字段，保留全部字段和值且可恢复原分组`, t => {
    const scope = vue.effectScope()
    t.after(() => scope.stop())
    const props = vue.reactive({ kind, record: records[0], index: 1, drawer: false, priorityContent: false })
    const state = scope.run(() => component.setup(props, { emit() {}, expose() {} }))
    records.forEach((record, index) => {
      props.record = record
      props.index = index + 1
      const original = model.detailSections(kind, record, index + 1)
      assert.deepEqual(state.displayedSections.value, original)

      props.priorityContent = true
      const displayed = state.displayedSections.value
      const originalFields = fieldsOf(original)
      const actualFields = fieldsOf(displayed)
      assert.deepEqual(displayed[0].fields.map(field => field.key), keys)
      assert.deepEqual(actualFields.map(field => field.key).sort(), originalFields.map(field => field.key).sort(), `${record.id} 不应遗漏或新增字段`)
      assert.equal(new Set(actualFields.map(field => field.key)).size, actualFields.length, `${record.id} 字段不应重复`)
      assert.deepEqual(sortedFields(actualFields), sortedFields(originalFields), `${record.id} 字段值、标签、数值类型及复制标识应完整保留`)
      assert.ok(displayed.every(section => section.fields.length > 0), '移走优先字段后不留下空分组')

      props.priorityContent = false
      assert.deepEqual(state.displayedSections.value, original, '取消优先展示应恢复原有分组与顺序')
    })
  })
}
