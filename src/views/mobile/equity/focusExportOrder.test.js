import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as fixtures from './fixtures.js'
import * as model from './model.js'
import * as orderActions from './orderActions.js'
import * as ledger from './demoLedger.js'
import * as columns from './focusTableColumns.js'
import * as tableColumns from './recordTableColumns.js'
import * as tableSorting from './tableSorting.js'
import { orderAccountOverview } from './accountOverview.js'

const ids = rows => rows.map(row => row.id)
function setup(file, props, onEmit = () => {}, environment = {}) {
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'focus-export-order-test' }).content
  const stubs = Object.fromEntries([...descriptor.scriptSetup.content.matchAll(/^import (\w+) from ['"][^'"]+\.vue['"]/gm)].map(([, name]) => [name, {}]))
  // 这些工作台/导出用例冻结订单生命周期；收盘与快照行为由独立业务用例验证。
  const imports = { useOrderSessionExpiry: () => () => [], ...vue, ...fixtures, ...model, ...orderActions, ...ledger, ...columns, ...tableColumns, ...tableSorting, orderAccountOverview, ...stubs, onMounted() {}, onBeforeUnmount() {}, useId: () => 'table-test', document: { querySelector() {} }, ...environment }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return component.setup(vue.reactive(props), { emit: onEmit, expose() {} })
}
async function exportedCsv(parent, kind) {
  let blob, clicked = false
  const tools = setup('./EquityFocusTools.vue', { kind, records: parent.focusExportRecords.value[kind], modelValue: null }, undefined, {
    URL: { createObjectURL(value) { blob = value; return 'blob:csv-test' }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { clicked = true } }) }, setTimeout() {},
  })
  tools.exportCsv()
  assert.ok(clicked)
  return blob.text()
}
function connectView(parent, kind, view) {
  const props = { kind, get records() { return parent.records.value[kind] }, columnKeys: columns.focusDefaultColumnKeys(kind), detailOnClick: true }
  return setup(view === 'list' ? './EquityFocusRecords.vue' : './EquityRecordsTable.vue', props, (event, order) => {
    if (event === 'order-change') parent.updateFocusRecordOrder(kind, view, order)
  })
}

for (const [kind, key] of [['positions', 'price'], ['orders', 'orderValueNumber'], ['trades', 'filledAmount']]) {
  test(`${kind} CSV 按当前列表及表格顺序导出，切换视图不沿用前一视图排序`, async t => {
    const scope = vue.effectScope()
    t.after(() => scope.stop())
    const parent = scope.run(() => setup('./EquityTrading.vue', { design: 'focus' }))
    const listScope = vue.effectScope()
    const list = listScope.run(() => connectView(parent, kind, 'list'))
    list.sortKey.value = key
    list.sortDirection.value = 'descending'
    const sortedListIds = ids(list.sortedRecords.value)
    assert.deepEqual(ids(parent.focusExportRecords.value[kind]), sortedListIds)
    assert.equal(await scope.run(() => exportedCsv(parent, kind)), columns.focusCsv(kind, list.sortedRecords.value).content.slice(1))
    listScope.stop()

    parent.focusDisplayMode.value = 'table'
    const tableScope = vue.effectScope()
    const table = tableScope.run(() => connectView(parent, kind, 'table'))
    assert.deepEqual(ids(parent.focusExportRecords.value[kind]), ids(table.sortedRecords.value))
    table.sortBy('code')
    assert.deepEqual(ids(parent.focusExportRecords.value[kind]), ids(table.sortedRecords.value))
    assert.equal(await scope.run(() => exportedCsv(parent, kind)), columns.focusCsv(kind, table.sortedRecords.value).content.slice(1))
    if (kind === 'orders') assert.equal(parent.focusExportRecords.value.orders[0].status, '异常')
    tableScope.stop()

    parent.focusDisplayMode.value = 'list'
    const nextList = scope.run(() => connectView(parent, kind, 'list'))
    assert.equal(nextList.sortKey.value, '')
    assert.deepEqual(ids(parent.focusExportRecords.value[kind]), ids(nextList.sortedRecords.value), '重建列表后立即使用当前默认顺序')
  })
}

test('筛选只导出当前记录，清空结果及旧排序事件都不会带回旧记录', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const parent = scope.run(() => setup('./EquityTrading.vue', { design: 'focus' }))
  const list = scope.run(() => connectView(parent, 'positions', 'list'))
  list.sortKey.value = 'price'
  list.sortDirection.value = 'descending'
  const oldIds = ids(list.sortedRecords.value)
  parent.searchDrafts.positions = '000001'
  parent.search('positions')
  assert.equal(parent.focusExportRecords.value.positions.length, 1)
  assert.deepEqual(ids(parent.focusExportRecords.value.positions), ids(list.sortedRecords.value))
  parent.searchDrafts.positions = '不存在的标的'
  parent.search('positions')
  parent.updateFocusRecordOrder('positions', 'list', oldIds)
  assert.deepEqual(parent.focusExportRecords.value.positions, [])
  assert.equal(await scope.run(() => exportedCsv(parent, 'positions')), columns.focusCsv('positions', []).content.slice(1))
  parent.resetFilters()
  assert.deepEqual(ids(parent.focusExportRecords.value.positions), ids(list.sortedRecords.value))
  assert.equal(parent.focusExportRecords.value.positions.length, 12)
  parent.selectedAccounts.value = []
  assert.deepEqual(parent.focusExportRecords.value.positions, [])
})

test('基线表格不发送 focus 排序事件，也不写入新版导出顺序', t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const parent = scope.run(() => setup('./EquityTrading.vue', { design: 'baseline' }))
  const events = []
  const table = scope.run(() => setup('./EquityRecordsTable.vue', { kind: 'positions', records: parent.records.value.positions, columnKeys: null, detailOnClick: false }, (...event) => events.push(event)))
  table.sortBy('price')
  assert.deepEqual(events, [])
  parent.updateFocusRecordOrder('positions', 'table', ['old-id'])
  assert.deepEqual(parent.focusRecordOrder, { list: {}, table: {} })
})
