import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as model from './model.js'
import * as focusColumns from './focusTableColumns.js'
import * as sorting from './tableSorting.js'
import { recordTableColumns } from './recordTableColumns.js'
import { orderRowActions, orderStatusVisual, orderStatuses } from './orderStatus.js'

// 来自 Customer Web tableFieldDefinitions / OrdersTable / TradesTable 的列契约快照。
const orderKeys = ['index', 'code', 'name', 'status', 'fillProgress', 'attribute', 'price', 'orderValueNumber', 'filledQuantity', 'filledPrice', 'side', 'filledAmount', 'canceledValue', 'frozenMargin', 'marginRate', 'orderNo', 'orderTime', 'account', 'market', 'currency', 'orderType', 'algorithm', 'orderRemark', 'feedback', 'openClose', 'reportQuantity']
const tradeKeys = ['index', 'side', 'code', 'name', 'filledPrice', 'filledQuantity', 'filledAmount', 'filledTime', 'orderTime', 'tradeNo', 'entrustNo', 'tradeDate', 'account', 'market', 'currency', 'orderType', 'algorithm', 'orderRemark', 'feedback', 'openClose']

function setupTable(kind, rows, extra = {}) {
  const { descriptor } = parse(readFileSync(new URL('./EquityRecordsTable.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'customer-parity' }).content
  const imports = { ...vue, ...model, ...focusColumns, ...sorting, recordTableColumns,
    EquityOrderStatus: {}, EquityOrderActions: {}, onMounted() {}, onBeforeUnmount() {}, useId: () => 'parity-table' }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  const events = [], props = vue.reactive({ kind, records: rows, design: 'baseline', columnKeys: null, detailOnClick: false, columnWidths: null, systemRunning: true, ...extra })
  return { props, events, state: component.setup(props, { expose() {}, emit: (...args) => events.push(args) }) }
}

test('委托优先展示状态与成交进度，26项字段完整；成交20项顺序保持不变', () => {
  for (const [kind, expected] of [['orders', orderKeys], ['trades', tradeKeys]]) {
    const columns = recordTableColumns(kind, 'baseline')
    assert.deepEqual(columns.map(column => column.key), expected)
    assert.equal(new Set(columns.map(column => column.key)).size, expected.length)
    assert.equal(columns.find(column => column.key === 'code').value({ code: '000001', name: '平安银行' }), '000001')
    assert.equal(columns.find(column => column.key === 'name').value({ code: '000001', name: '平安银行' }), '平安银行')
  }
  assert.equal(recordTableColumns('trades').find(column => column.key === 'filledQuantity').value({ filledQuantity: 300 }), '300')
})

test('两表复用固定标的列，委托操作点击行展开，成交保留详情入口', () => {
  const scope = vue.effectScope()
  for (const [kind, expected] of [['orders', orderKeys], ['trades', tradeKeys]]) for (const columnKeys of [null, expected.filter(key => key !== 'index')]) {
    const { state, events } = scope.run(() => setupTable(kind, [], { columnKeys }))
    assert.deepEqual(state.columns.value.map(column => column.key), expected.filter(key => !['index', 'code', 'name'].includes(key)))
    assert.equal(state.hasHistoryColumn.value, true)
    assert.equal(state.hasSymbolColumn.value, true)
    assert.equal(state.symbolColumnWidth.value, 96)
    assert.equal(state.hasExpandableActions.value, kind === 'orders')
    state.handleRecordClick({ id: 'one', name: '平安银行' }, 0, {})
    if (kind === 'orders') {
      assert.equal(state.expandedRecordId.value, 'one')
      state.handleRecordClick({ id: 'two', name: '晶澳科技' }, 1, {})
      assert.equal(state.expandedRecordId.value, 'two', '切换行只展开当前行')
      state.handleRecordClick({ id: 'two', name: '晶澳科技' }, 1, {})
      assert.equal(state.expandedRecordId.value, null, '再次点击收起')
      assert.equal(events.some(event => event[0] === 'open'), false)
    } else assert.equal(events.at(-1)[0], 'open')
  }
  const source = readFileSync(new URL('./EquityRecordsTable.vue', import.meta.url), 'utf8')
  assert.match(source, /<EquityOrderActions :record="record" :system-running="systemRunning"/)
  assert.doesNotMatch(source, /table-operation-cell/)
  const { state: history, events: historyEvents } = scope.run(() => setupTable('orders', [], { readonly: true }))
  assert.equal(history.hasExpandableActions.value, false)
  history.handleRecordClick({ id: 'historical' }, 0, {})
  assert.equal(history.expandedRecordId.value, null)
  assert.deepEqual(historyEvents, [])
  scope.stop()
})

test('全部状态、系统/手工、剩余数量及运行状态遵循 Web 操作矩阵', () => {
  for (const status of orderStatuses) for (const orderType of ['系统单', '手工单']) for (const filledQuantity of [0, 1000]) for (const running of [true, false]) {
    const row = { status, orderType, quantity: 1000, filledQuantity }
    const actions = orderRowActions(row, running)
    if (running && status === '异常' && orderType === '系统单') {
      assert.deepEqual(actions.map(action => action.key), ['convert'])
      assert.equal(actions[0].disabled, false)
    } else {
      assert.deepEqual(actions.map(action => action.key), ['amend', 'cancel'])
      const allowed = running && filledQuantity < 1000 && ['待报', '已报', '部成'].includes(status)
      assert.ok(actions.every(action => action.disabled === !allowed))
      if (!allowed) assert.ok(actions.every(action => action.reason))
    }
    assert.equal(actions.some(action => action.key === 'chase'), false)
  }
})

test('当日与只读历史订单保留相同前置列、Web圆环和左对齐，进度值限制在0至100且缺失值不伪造进度', () => {
  const scope = vue.effectScope()
  for (const readonly of [false, true]) {
    const { state } = scope.run(() => setupTable('orders', [], { readonly }))
    assert.deepEqual(state.columns.value.slice(0, 7).map(column => column.key), ['status', 'fillProgress', 'attribute', 'price', 'orderValueNumber', 'filledQuantity', 'filledPrice'])
    for (const [filledQuantity, expected] of [[0, 0], [500, 50], [1000, 100], [1500, 100], [-100, 0]]) {
      assert.equal(state.progressPercent({ quantity: 1000, filledQuantity }), expected)
    }
    assert.ok(Number.isNaN(state.progressPercent({ quantity: 0, filledQuantity: 0 })))
    assert.ok(Number.isNaN(state.progressPercent({ quantity: 1000 })))
    assert.equal(state.columns.value.find(column => column.key === 'fillProgress').width, 84)
  }
  const source = readFileSync(new URL('./EquityRecordsTable.vue', import.meta.url), 'utf8')
  assert.equal((source.match(/'table-progress-cell': column.key === 'fillProgress'/g) || []).length, 2, '表头与单元格同列左对齐')
  assert.match(source, /\.table-progress-cell \.table-sort-button \{ justify-content: flex-start/)
  assert.match(source, /class="order-fill-progress" role="progressbar"/)
  assert.match(source, /:stroke-dasharray="`\$\{progressPercent\(record\)\} 100`"/)
  assert.match(source, /\.order-fill-progress svg \{ width: 20px; height: 20px/)
  assert.match(source, /\.order-fill-progress-track \{ stroke: #41464e/)
  assert.match(source, /\.order-fill-progress-value \{ stroke: #bb984a/)
  scope.stop()
})

test('状态标识保留 Web 的八类色调和图标，拒单与异常不混为同一状态', () => {
  const expected = { 未报: 'pending', 待报: 'pending', 已报: 'reported', 待改: 'review', 待撤: 'pending', 部撤: 'draft', 撤单: 'draft', 部成: 'partial', 全成: 'success', 拒单: 'rejected', 异常: 'exception' }
  for (const [status, tone] of Object.entries(expected)) assert.equal(orderStatusVisual(status).tone, tone)
  assert.notEqual(orderStatusVisual('拒单').path, orderStatusVisual('异常').path)
})

test('移除序号及合并标的后，异常订单在升降序及恢复顺序后仍置顶', () => {
  const scope = vue.effectScope()
  const rows = [{ id: 'normal', price: 10, status: '已报' }, { id: 'exception', price: 20, status: '异常' }, { id: 'another', price: 30, status: '部成' }]
  const { state } = scope.run(() => setupTable('orders', rows))
  for (let index = 0; index < 3; index++) {
    state.sortBy('price')
    assert.equal(state.sortedRecords.value[0].id, 'exception')
    assert.equal(state.columns.value.some(column => ['index', 'code', 'name'].includes(column.key)), false)
  }
  assert.deepEqual(rows.map(row => row.id), ['normal', 'exception', 'another'])
  scope.stop()
})
