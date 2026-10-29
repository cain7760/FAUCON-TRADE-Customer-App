import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as fixtures from './fixtures.js'
import * as model from './model.js'
import * as orderActions from './orderActions.js'
import * as ledger from './demoLedger.js'
import * as focusTableColumns from './focusTableColumns.js'
import { orderAccountOverview } from './accountOverview.js'
import { recordTableColumns } from './recordTableColumns.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const elements = node => [node, ...(node.children || []).flatMap(elements)]
const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
const directive = (node, name, argument) => node.props?.find(prop => prop.type === 7 && prop.name === name && (!argument || prop.arg?.content === argument))?.exp?.content
test('基线顶部品牌暗纹靠左，低对比渐变在标签栏底部融入页面底色', () => {
  const css = read('../mobile.css')
  const background = css.match(/\.mobile-app--baseline\.mobile-app--equity-home\s*\{([^}]+)\}/)[1]
  assert.match(background, /var\(--app-color-accent\) 6%, transparent/)
  assert.match(background, /linear-gradient\(180deg, var\(--app-color-card\), var\(--app-color-background\)\)/)
  const mark = css.match(/\.mobile-equity-brand-mark\s*\{([^}]+)\}/)[1]
  assert.match(mark, /left:\s*-18px/)
  assert.doesNotMatch(mark, /right:/)
  assert.match(mark, /pointer-events:\s*none/)
})
test('基线所有记录卡片隐藏外描边并使用8px圆角，保留尺寸和内部信息分隔线', () => {
  const css = read('./equity.css')
  assert.match(css, /\.mobile-app--baseline \.equity-record\s*\{\s*border-color:\s*transparent;\s*border-radius:\s*8px;\s*\}/)
  assert.match(css, /\.mobile-app--baseline \.record-detail-trigger\s*\{\s*border-radius:\s*8px;\s*\}/)
  assert.match(css, /\.equity-record\s*\{[^}]*border:\s*1px solid var\(--app-color-border\)/)
  for (const selector of ['record-metrics', 'record-foot', 'position-card-footer']) {
    assert.match(css.match(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`))[1], /border-top:\s*1px solid var\(--app-color-border\)/)
  }
})
test('基线表格移除标的展开箭头但保留按钮展开行为和无障碍状态', () => {
  const source = read('./EquityRecordsTable.vue')
  const nodes = elements(parse(source).descriptor.template.ast)
  const trigger = nodes.find(node => attribute(node, 'class') === 'table-detail-trigger')
  assert.doesNotMatch(source, /table-expand-chevron/)
  assert.equal(directive(trigger, 'on', 'click'), 'handleRecordClick(record, index, $event)')
  assert.match(directive(trigger, 'bind', 'aria-expanded'), /expandedRecordId === record.id/)
})
test('基线表头12px、非标的单元格14px且统一28px内容间距，独立列配置仍保留', () => {
  const source = read('./EquityRecordsTable.vue')
  assert.match(source, /--table-column-padding:\s*14px/)
  assert.match(read('../../../style/mobile-theme.css'), /--table-row-divider:\s*rgb\(32 34 38 \/ 70%\)/)
  assert.match(read('../../../style/mobile-theme.css'), /--table-header-surface:\s*#1a1c20/)
  assert.match(source, /\.equity-table-view--baseline thead th\s*\{\s*font-size:\s*12px/)
  assert.match(source, /\.equity-table-view--baseline tbody tr:not\(\.table-actions-row\) > td\s*\{\s*font-size:\s*14px/)
  assert.match(source, /props.design === 'baseline' && !isConfigured.value && !props.columnWidths/)
  assert.match(source, /useContentColumnWidths \? 'max-content' : `\$\{tableWidth\}px`/)
  assert.match(source, /\.is-content-sized tbody tr:not\(\.table-actions-row\) > td\s*\{\s*padding-inline:\s*var\(--table-column-padding\)/)
})
function setup(file, props = {}, environment = {}) {
  const { descriptor } = parse(read(file))
  const script = compileScript(descriptor, { id: 'equity-workspace-test' }).content
  const events = []
  const componentStubs = Object.fromEntries([...descriptor.scriptSetup.content.matchAll(/^import (\w+) from ['"][^'"]+\.vue['"]/gm)].map(([, name]) => [name, {}]))
  // 这些工作台/导出用例冻结订单生命周期；收盘与快照行为由独立业务用例验证。
  const imports = { useOrderSessionExpiry: () => () => [], ...vue, ...fixtures, ...model, ...orderActions, ...ledger, ...focusTableColumns, orderAccountOverview, recordTableColumns, ...componentStubs, showAppMessage() {}, document: { querySelector() {} }, ...environment }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return { state: component.setup(vue.reactive(props), { emit: (...event) => events.push(event), expose() {} }), events }
}

test('品牌背景随权益详情进入和返回切换，不影响首页', () => {
  const scope = vue.effectScope()
  const { state, events } = scope.run(() => setup('./EquityTrading.vue', { design: 'baseline' }))
  assert.deepEqual(events.find(event => event[0] === 'home-change'), ['home-change', true])
  for (const kind of ['orders', 'trades', 'positions']) {
    state.selectedRecord.value = { kind, row: fixtures.demoRecords[kind][0] }
    assert.deepEqual(events.filter(event => event[0] === 'home-change').at(-1), ['home-change', false])
    state.selectedRecord.value = null
    assert.deepEqual(events.filter(event => event[0] === 'home-change').at(-1), ['home-change', true])
  }
  const app = read('../CustomerMobileApp.vue')
  assert.match(app, /@home-change="isEquityHome = \$event"/)
  assert.equal((app.match(/v-if="design === 'baseline' && activeTab === 'equity' && isEquityHome"/g) || []).length, 2)
  scope.stop()
})

test('首页三项资金按列表账户汇总，独立于搜索并随委托占用同步更新', () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue', { design: 'baseline' }))
  assert.deepEqual(state.portfolioOverview.value, { available: 945527.41, marketValue: 3688487, floatingProfit: 26012 })
  state.applied.positions.symbol = '不存在的证券'
  assert.equal(state.records.value.positions.length, 0)
  assert.equal(state.portfolioOverview.value.marketValue, 3688487, '标的筛选不改变账户资产范围')
  state.selectedAccounts.value = ['TZS_T0', 'TZS_T1']
  assert.equal(state.accountSummary.value, '2个账户')
  assert.deepEqual(state.portfolioOverview.value, { available: 1566327.41, marketValue: 11065461, floatingProfit: 78036 })
  state.demoOrders.value.push({ id: 'overview-buy', account: 'TZS_T0', code: '000001', market: 'SZ', currency: 'CNY', side: 'buy', type: 'limit', status: '待报', price: 11.78, quantity: 100, filledQuantity: 0 })
  assert.equal(state.portfolioOverview.value.available, 1565149.41, '只扣除新增委托占用的1178元')
  state.demoOrders.value.at(-1).status = '撤单'
  assert.equal(state.portfolioOverview.value.available, 1566327.41, '撤单释放后自动恢复可用资金')
  state.selectedAccounts.value = ['TZS_T1']
  assert.equal(state.accountSummary.value, '自营二号')
  assert.deepEqual(state.portfolioOverview.value, { available: 620800, marketValue: 7376974, floatingProfit: 52024 })
  state.selectedAccounts.value = ['TZS_T2']
  assert.deepEqual(state.portfolioOverview.value, { available: 0, marketValue: 0, floatingProfit: 0 })
  scope.stop()
})

test('编号复制优先同步写入，失败回退异步API，均失败不显示成功', async () => {
  for (const mode of ['sync', 'async', 'failure']) {
    let clipboard = '', removed = false, restored = false
    const input = { value: '', style: {}, select() {}, setSelectionRange() {}, remove() { removed = true } }
    const document = {
      createElement: () => input, body: { append() {} }, activeElement: { focus() { restored = true } },
      execCommand(command) { assert.equal(command, 'copy'); if (mode === 'sync') { clipboard = input.value; return true } return false },
    }
    const navigator = { clipboard: { async writeText(value) { if (mode === 'failure') throw Error('denied'); clipboard = value } } }
    const scope = vue.effectScope()
    const toasts = []
    const { state } = scope.run(() => setup('./EquityDetail.vue', { kind: 'orders', record: fixtures.demoRecords.orders[0], index: 1 }, { document, navigator, showAppMessage: (...args) => toasts.push(args) }))
    await state.copyIdentifier({ label: '订单编号', value: 'WT20260911016' })
    assert.equal(removed && restored, true)
    assert.equal(clipboard, mode === 'failure' ? '' : 'WT20260911016')
    assert.deepEqual(toasts, [mode === 'failure' ? ['复制失败，请长按编号手动复制', 'error'] : ['已复制：WT20260911016']])
    scope.stop()
  }
  assert.doesNotMatch(read('./EquityDetail.vue'), /copy-feedback/)
})

test('提交后清除会隐藏新委托的旧条件、切换实际账户并显示订单，失败不显示成功', () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue', { design: 'baseline' }))
  state.applied.orders.symbol = '不存在的证券'
  state.applied.orders.status = ['拒单']
  state.searchDrafts.orders = '不存在的证券'
  const snapshot = { symbol: fixtures.orderInstruments[0], account: 'TZS_T1', type: 'limit', execution: 'lowTouch', side: 'buy', price: 11.78, quantity: 100, algorithmCode: 'DMA', inputAmount: null }
  let reply
  state.confirmOrder(snapshot, value => { reply = value })
  assert.equal(reply.error, undefined)
  assert.equal(state.activeList.value, 'orders')
  assert.deepEqual(state.selectedAccounts.value, ['TZS_T1'])
  assert.deepEqual(state.applied.orders, model.defaultFilters())
  assert.equal(state.searchDrafts.orders, '')
  assert.equal(state.records.value.orders.length, 36)
  assert.ok(state.records.value.orders.some(row => row.quantity === 100 && /^\d{18}$/.test(row.orderNo)))
  const count = state.demoOrders.value.length
  state.confirmOrder({ ...snapshot, account: 'TZS_T2' }, value => { reply = value })
  assert.match(reply.error, /超出最大可买/)
  assert.equal(state.demoOrders.value.length, count)
  scope.stop()
})

test('方案 C 独立展示默认表格、PC 数据及详情平仓，保留行入口焦点', async () => {
  const { state } = setup('./EquityTrading.vue', { design: 'c' })
  assert.equal(state.isConceptC.value, true)
  assert.equal(state.isFocusDesign.value, false)
  assert.equal(state.usesPcRules.value, true)
  assert.equal(state.displayMode.value, 'table')
  const row = state.records.value.positions.find(record => record.code === '000002')
  assert.ok(row.executionType)
  let focused = 0
  const trigger = { isConnected: true, focus() { focused += 1 } }
  state.openDetail('positions', row, 1, { currentTarget: { tagName: 'TR', querySelector: () => trigger } })
  assert.equal(state.positionDetailVisible.value, true)
  state.openDetailAction({ action: 'close' })
  assert.equal(state.positionDetailVisible.value, false)
  state.closeDetail()
  assert.deepEqual(state.orderEntryContext.value.record, row)
  assert.equal(state.orderEntryContext.value.action, 'close')
  assert.equal(state.isActionVisible.value, true)
  state.restoreFocus()
  await vue.nextTick()
  assert.equal(focused, 1)
})

test('列表账户入口36px并保留胶囊背景，Tab 使用下划线且所有计数为主色', () => {
  const css = read('./equity.css')
  const account = css.match(/\.equity-account\s*\{([^}]+)\}/)[1]
  assert.match(account, /min-height:\s*36px/)
  assert.match(account, /border-radius:\s*999px/)
  assert.match(account, /background:\s*var\(--app-color-control\)/)
  const theme = read('../../../style/mobile-theme.css')
  assert.match(theme.match(/\.equity-tab-total\s*\{([^}]+)\}/)[1], /color:\s*var\(--app-color-accent\)/)
  assert.match(theme, /\.van-tab--active \.equity-tab-title\s*\{\s*border-bottom-color:\s*var\(--app-color-accent\)/)
  const selected = theme.match(/\.equity-list-tabs \.van-tab--active\s*\{([^}]+)\}/)[1]
  assert.match(selected, /background:\s*transparent/)
  assert.doesNotMatch(selected, /border-color:/)
})

test('搜索表单仅有框内右侧清空和提交按钮，保留 Enter 提交', () => {
  const nodes = elements(parse(read('./EquityTrading.vue')).descriptor.template.ast)
  const form = nodes.find(node => attribute(node, 'class') === 'equity-quick-search')
  assert.equal(directive(form, 'on', 'submit'), 'search(list.key)')
  assert.ok(!form.children.some(node => node.tag === 'button'))
  const field = elements(form).find(node => attribute(node, 'class') === 'equity-search-field')
  const actions = elements(field).find(node => attribute(node, 'class') === 'equity-search-actions')
  const buttons = actions.children.filter(node => node.tag === 'button')
  assert.deepEqual(buttons.map(node => attribute(node, 'type')), ['button', 'submit'])
  assert.equal(directive(buttons[0], 'on', 'click'), 'clearSearch(list.key, $event)')
  const css = read('./equity.css')
  assert.match(css, /\.equity-search-field:is\(:focus-within, \.has-query\) \.equity-search-leading\s*\{\s*display:\s*none/)
  assert.match(css, /\.equity-search-field:is\(:focus-within, \.has-query\) \.equity-search-actions\s*\{\s*display:\s*flex/)
  assert.doesNotMatch(css, /\.equity-search-submit/)
})

test('基线Tab数量标识保留独立样式且不影响focus', () => {
  assert.match(read('./EquityTrading.vue'), /'equity-tab-total--baseline': !isFocusDesign/)
  assert.match(read('../../../style/mobile-theme.css'), /\.equity-tab-total--baseline\s*\{\s*font-size:\s*14px;\s*font-weight:\s*700/)
})

test('基线表格贴边展示，不改单元格内距及其他方案的外侧间距', () => {
  const table = read('./EquityRecordsTable.vue')
  assert.match(table.match(/\.equity-table-view\s*\{([^}]+)\}/)[1], /padding:\s*0\s*;/)
  assert.match(table.match(/th, td\s*\{([^}]+)\}/)[1], /padding:\s*4px\s*;/)
  assert.match(read('./focus-design.css'), /\.mobile-app--focus \.equity-table-view\s*\{\s*padding:\s*0 20px/)
  assert.match(read('./concept-c.css'), /\.mobile-app--concept-c \.equity-table-view\s*\{\s*padding:\s*0\s*;/)
})

test('现版基线三页筛选工具栏52px、上下8px留白，标的内容对齐搜索框左边缘', () => {
  const css = read('./equity.css')
  assert.match(css, /\.mobile-app--baseline \.equity-toolbar\s*\{\s*min-height:\s*52px\s*;\s*padding-block:\s*8px\s*;/)
  const table = read('./EquityRecordsTable.vue')
  assert.match(table, /\.is-position-scroll thead \.table-symbol\s*\{[^}]*padding-inline-start:\s*12px;[^}]*padding-inline-end:\s*0/)
  assert.match(table, /\.is-position-scroll \.table-detail-trigger\s*\{[^}]*padding-inline-start:\s*12px;[^}]*padding-inline-end:\s*0/)
})

test('基线底部抽屉采用方案 C 的18px顶部圆角，居中弹窗及其他方案保持原样', () => {
  const nodes = elements(parse(read('../CustomerMobileApp.vue')).descriptor.template.ast)
  const main = nodes.find(node => node.tag === 'main')
  assert.match(directive(main, 'bind', 'class'), /'mobile-app--baseline': design === 'baseline'/)
  const theme = read('../../../style/mobile-theme.css')
  const baseline = theme.match(/\.mobile-app\.mobile-app--baseline \.van-popup\.van-popup--bottom\s*\{([^}]+)\}/)[1]
  assert.match(baseline, /border-radius:\s*18px 18px 0 0/)
  assert.match(read('./order-entry.css').match(/\.equity-algorithm-dialog\.van-popup\s*\{([^}]+)\}/)[1], /border-radius:\s*4px\s*;/)
  assert.match(read('./focus-design.css').match(/\.mobile-app--focus \.equity-filter-sheet\.van-popup\s*\{([^}]+)\}/)[1], /border-radius:\s*16px 16px 0 0/)
  assert.match(read('./concept-c.css').match(/\.concept-c-position-sheet\.van-popup\s*\{([^}]+)\}/)[1], /border-radius:\s*18px 18px 0 0/)
})

test('仅基线持仓表格移除容器外框，保留行分隔线与键盘焦点', () => {
  const table = read('./EquityRecordsTable.vue')
  assert.match(table, /'is-position-scroll': kind === 'positions' && !detailOnClick/)
  assert.match(table, /\.equity-table-scroll\.is-position-scroll\s*\{\s*border:\s*0/)
  assert.match(table, /\.is-position-scroll \.table-expanded-actions\s*\{\s*width:\s*100cqw/)
  assert.match(table, /th, td\s*\{[^}]*border-bottom:\s*1px solid/)
  assert.match(table, /\.equity-table-scroll:focus-visible\s*\{\s*outline:\s*2px solid/)
})

test('基线账户视觉高28px、图标13px，保留44px命中区且不改变focus', () => {
  const source = read('./EquityTrading.vue')
  const css = read('./equity.css')
  assert.match(source, /<EquityAccountTrigger[^>]*:compact="!isFocusDesign"/)
  assert.match(css, /\.mobile-app--baseline \.equity-account--compact\s*\{[^}]*min-height:\s*28px;\s*height:\s*28px/)
  assert.match(css, /\.mobile-app--baseline \.equity-account--compact::before\s*\{[^}]*inset:\s*-8px 0/)
  assert.match(css, /\.equity-account--compact \.equity-account-icon\s*\{\s*width:\s*13px;\s*height:\s*13px/)
  assert.match(read('./focus-design.css'), /\.mobile-app--focus \.equity-account\s*\{\s*min-height:\s*36px/)
})

test('持仓展开区不重复数量，仅保留详情和平仓入口及原有事件', () => {
  const source = read('./EquityRecordsTable.vue')
  const nodes = elements(parse(source).descriptor.template.ast)
  assert.equal(nodes.some(node => attribute(node, 'class') === 'table-position-capacity'), false)
  const detail = nodes.find(node => attribute(node, 'class') === 'record-action record-action-detail')
  assert.equal(directive(detail, 'on', 'click'), "emit('open', { record, index: index + 1, event: $event })")
  const close = nodes.find(node => attribute(node, 'class') === 'record-action record-action-close')
  assert.equal(directive(close, 'on', 'click'), "$emit('action', { record, action: 'close', event: $event })")
  assert.ok(nodes.some(node => node.tag === 'EquityOrderActions'))
})

test('基线持仓平仓保留命名按钮、装饰图标、44px热区与键盘焦点', () => {
  const source = read('./EquityRecordsTable.vue')
  const nodes = elements(parse(source).descriptor.template.ast)
  const close = nodes.find(node => attribute(node, 'class') === 'record-action record-action-close')
  assert.equal(close.tag, 'button')
  assert.equal(attribute(close, 'type'), 'button')
  const closeIcon = elements(close).find(node => attribute(node, 'class') === 'record-action-icon')
  assert.ok(closeIcon)
  assert.equal(attribute(closeIcon, 'aria-hidden'), 'true')
  assert.equal(directive(close, 'bind', 'aria-label'), '`${record.name}平仓`')
  assert.match(source, /\.table-expanded-actions \.record-action\s*\{[^}]*min-height:\s*44px/)
  assert.match(source, /\.table-expanded-actions button:focus-visible\s*\{\s*outline:\s*2px solid/)
})

test('基线委托和成交历史均打开完整历史面板，暂停交易也可查看', () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue', { design: 'baseline' }))
  state.systemRunning.value = false
  for (const kind of ['orders', 'trades']) {
    const record = fixtures.demoRecords[kind][0]
    state.openTableAction(kind, { record, action: 'history', event: { currentTarget: {} } })
    assert.equal(state.historyVisible.value, true)
    assert.deepEqual(state.historyContext.value, { kind, record })
    assert.equal(state.operationContext.value, null)
  }
  scope.stop()
})

test('输入不自动筛选，提交后搜索，清空只重置本列表标的查询', () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue'))
  state.applied.positions.direction = '多'
  state.searchDrafts.positions = '000001'
  state.searchDrafts.orders = '002459'
  state.applied.orders.symbol = '002459'
  assert.equal(state.records.value.positions.length, 12)
  state.search('positions')
  assert.equal(state.records.value.positions.length, 1)
  let focused = false
  state.clearSearch('positions', { currentTarget: { closest: () => ({ querySelector: () => ({ focus() { focused = true } }) }) } })
  assert.equal(state.records.value.positions.length, 12)
  assert.equal(state.applied.positions.direction, '多')
  assert.equal(state.searchDrafts.positions, '')
  assert.equal(state.searchDrafts.orders, '002459')
  assert.equal(state.applied.orders.symbol, '002459')
  assert.deepEqual(state.selectedAccounts.value, ['TZS_T0'])
  assert.ok(focused)
  scope.stop()
})

test('三个列表筛选仅修改各自条件，账户范围只由顶部账户入口更改', () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue'))
  state.selectedAccounts.value = ['TZS_T0', 'TZS_T1']
  for (const kind of ['positions', 'orders', 'trades']) {
    state.activeList.value = kind
    state.accountOnly.value = false
    state.applyFilters({ filters: { ...model.defaultFilters(), symbol: '平安' }, accounts: ['TZS_T2'] })
    assert.deepEqual(state.selectedAccounts.value, ['TZS_T0', 'TZS_T1'])
    assert.equal(state.applied[kind].symbol, '平安')
  }
  state.accountOnly.value = true
  state.applyFilters({ filters: model.defaultFilters(), accounts: ['TZS_T1'] })
  assert.deepEqual(state.selectedAccounts.value, ['TZS_T1'])
  assert.equal(state.applied.trades.symbol, '平安')
  scope.stop()
})

test('持仓详情作为抽屉保持列表状态，关闭后恢复原列表入口焦点', async () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue'))
  let focused = false
  const trigger = { isConnected: true, focus() { focused = true } }
  state.searchDrafts.positions = '平安'
  state.search('positions')
  state.openDetail('positions', fixtures.demoRecords.positions[0], 1, { currentTarget: trigger })
  assert.ok(state.isPositionDetail.value)
  assert.ok(state.positionDetailVisible.value)
  assert.ok(state.isOverlayOpen.value)
  state.positionDetailVisible.value = false
  assert.ok(state.isOverlayOpen.value, '关闭动画期间背景仍不可操作')
  state.closeDetail()
  await vue.nextTick()
  assert.equal(state.selectedRecord.value, null)
  assert.ok(!state.isOverlayOpen.value)
  assert.equal(state.applied.positions.symbol, '平安')
  assert.equal(state.activeList.value, 'positions')
  assert.ok(focused)
  scope.stop()
})

test('持仓抽屉平仓复用原操作上下文，待抽屉关闭后打开并保留返回入口', async () => {
  const scope = vue.effectScope()
  const { state } = scope.run(() => setup('./EquityTrading.vue'))
  let focused = false
  const trigger = { isConnected: true, focus() { focused = true } }
  const record = fixtures.demoRecords.positions[0]
  state.openDetail('positions', record, 1, { currentTarget: trigger })
  state.openDetailAction({ action: 'close' })
  assert.ok(!state.positionDetailVisible.value)
  assert.ok(!state.isActionVisible.value)
  state.closeDetail()
  assert.ok(state.isActionVisible.value)
  assert.deepEqual(state.orderEntryContext.value, { record, action: 'close' })
  state.isActionVisible.value = false
  state.restoreFocus()
  await vue.nextTick()
  assert.ok(focused)
  scope.stop()
})

test('持仓抽屉字段和值完整保留，仅调整展示顺序；订单成交详情不变', () => {
  const scope = vue.effectScope()
  const record = fixtures.demoRecords.positions[0]
  const { state } = scope.run(() => setup('./EquityDetail.vue', { kind: 'positions', record, index: 1, drawer: true }))
  const expected = model.detailSections('positions', record, 1).flatMap(section => section.fields)
  const actual = state.displayedSections.value.flatMap(section => section.fields)
  const sorted = fields => fields.toSorted((a, b) => a.key.localeCompare(b.key))
  assert.deepEqual(sorted(actual), sorted(expected))
  assert.deepEqual(actual.map(field => field.key), ['name', 'code', 'price', 'floatingProfit', 'qty', 'available', 'value', 'opening', 'marginOccupied', 'marginRate', 'account', 'market', 'currency', 'direction', 'totalProfit', 'dailyRealizedProfit', 'orderRemark', 'traderRemark'])
  assert.ok(!actual.some(field => field.key === 'index'))
  assert.ok(!actual.some(field => field.label === '订单来源'))
  for (const kind of ['orders', 'trades']) {
    const row = fixtures.demoRecords[kind][0]
    const detail = scope.run(() => setup('./EquityDetail.vue', { kind, record: row, index: 1, drawer: false })).state
    assert.deepEqual(detail.displayedSections.value, model.detailSections(kind, row, 1))
  }
  scope.stop()
})

test('持仓抽屉仅作用于持仓，背景列表仍在且关闭使用原生 Popup 生命周期', () => {
  const nodes = elements(parse(read('./EquityTrading.vue')).descriptor.template.ast)
  const workspace = nodes.find(node => attribute(node, 'class') === 'equity-workspace')
  assert.equal(directive(workspace, 'show'), '!selectedRecord || isPositionDetail || isFocusDesign')
  const popup = nodes.find(node => attribute(node, 'class') === 'equity-filter-sheet equity-position-sheet')
  assert.equal(popup.tag, 'van-popup')
  assert.equal(directive(popup, 'if'), 'isPositionDetail && !isFocusDesign')
  assert.equal(attribute(popup, 'position'), 'bottom')
  assert.equal(directive(popup, 'model', 'show'), 'positionDetailVisible')
  assert.ok(popup.props.some(prop => prop.type === 6 && prop.name === 'transition-appear'))
  assert.equal(directive(popup, 'on', 'closed'), 'closeDetail')
  assert.ok(elements(popup).some(node => node.tag === 'EquityDetail' && node.props.some(prop => prop.type === 6 && prop.name === 'drawer')))
})

test('持仓代码币种紧跟名称，抽屉分组标题白色加粗，正文统一 12px', () => {
  const nodes = elements(parse(read('./EquityDetail.vue')).descriptor.template.ast)
  const identity = nodes.find(node => attribute(node, 'class') === 'position-detail-identity')
  const children = identity.children.filter(node => node.type === 1)
  assert.deepEqual(children.map(node => node.tag), ['h2', 'p', 'span'])
  assert.equal(attribute(children[1], 'class'), 'position-detail-meta')
  assert.equal(attribute(children[2], 'class'), 'position-detail-direction')
  const css = read('./equity.css')
  const heading = css.match(/\.equity-detail--drawer \.detail-section > h3\s*\{([^}]+)\}/)[1]
  assert.match(heading, /color:\s*var\(--app-color-text\)/)
  assert.match(heading, /font-weight:\s*700/)
  for (const selector of ['detail-scroll', 'detail-field']) {
    const rule = css.match(new RegExp(`\\.equity-detail--drawer \\.${selector}\\s*\\{([^}]+)\\}`))[1]
    assert.match(rule, /font-size:\s*12px/)
  }
  assert.match(css.match(/\.detail-field\s*\{([^}]+)\}/)[1], /font-size:\s*13px/)
})

test('持仓抽屉支持 Escape 关闭与 Tab 焦点循环', () => {
  const scope = vue.effectScope()
  const document = { activeElement: null }
  const { state, events } = scope.run(() => setup('./EquityDetail.vue', { kind: 'positions', record: fixtures.demoRecords.positions[0], index: 1, drawer: true }, { document }))
  const buttons = Array.from({ length: 2 }, () => ({ getClientRects: () => [1], focus() { document.activeElement = this } }))
  let prevented = 0
  const event = { key: 'Tab', currentTarget: { querySelectorAll: () => buttons }, preventDefault() { prevented++ } }
  document.activeElement = buttons[1]
  state.handleKeyboard(event)
  assert.equal(document.activeElement, buttons[0])
  state.handleKeyboard({ ...event, shiftKey: true })
  assert.equal(document.activeElement, buttons[1])
  state.handleKeyboard({ ...event, key: 'Escape' })
  assert.equal(prevented, 3)
  assert.deepEqual(events, [['back']])
  scope.stop()
})

test('新版持仓采用 PC 显式执行元数据，三个手工标的不污染现版基线', t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const baselineBefore = structuredClone(fixtures.demoRecords.positions)
  const baseline = scope.run(() => setup('./EquityTrading.vue', { design: 'baseline' })).state
  const focus = scope.run(() => setup('./EquityTrading.vue', { design: 'focus' })).state
  assert.equal(focus.records.value.positions.length, baseline.records.value.positions.length)
  const manual = focus.records.value.positions.filter(row => row.executionType === 'highTouch')
  assert.equal(manual.length, 3)
  assert.ok(manual.every(row => row.orderType === '手工单'))
  for (const row of focus.records.value.positions) {
    assert.ok(['highTouch', 'lowTouch'].includes(row.executionType))
    assert.ok(['POV', 'DMA'].includes(row.algorithm))
    assert.equal(row.positionDate, '2026-09-18')
    assert.equal(row.lotSize, 100)
    const original = baseline.records.value.positions.find(item => item.id === row.id)
    assert.notEqual(row, original)
    assert.equal(row.qty, original.qty)
    assert.equal(row.available, original.available)
    assert.equal(row.floatingProfit, original.floatingProfit)
    assert.deepEqual(row.sourceOrderTypes, original.sourceOrderTypes)
  }
  assert.deepEqual(fixtures.demoRecords.positions, baselineBefore)
  assert.ok(baseline.records.value.positions.every(row => !Object.hasOwn(row, 'executionType')))
})

test('新版暂停时仍能查看历史，关闭历史回到详情，关闭详情回到原列表入口', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const { state } = scope.run(() => setup('./EquityTrading.vue', { design: 'focus', orderReview: false }))
  const focused = []
  const listTrigger = { isConnected: true, focus() { focused.push('list') } }
  const historyTrigger = { isConnected: true, focus() { focused.push('history') } }
  const row = state.demoOrders.value[0]
  state.systemRunning.value = false
  state.openDetail('orders', row, 1, { currentTarget: listTrigger })
  assert.ok(state.isOverlayOpen.value)
  assert.equal(state.positionDetailVisible.value, false)
  state.openFocusAction({ action: 'history', event: { currentTarget: historyTrigger } })
  assert.equal(state.historyVisible.value, true)
  assert.deepEqual(state.historyContext.value, { kind: 'orders', record: row })
  assert.equal(state.selectedRecord.value.row, row)
  assert.equal(state.operationVisible.value, false)
  state.historyVisible.value = false
  state.restoreHistoryFocus()
  await vue.nextTick()
  assert.deepEqual(focused, ['history'])
  assert.ok(state.isOverlayOpen.value, '历史关闭后仍由详情保持背景不可操作')
  state.closeDetail()
  await vue.nextTick()
  assert.deepEqual(focused, ['history', 'list'])
  assert.equal(state.isOverlayOpen.value, false)
})

test('新版暂停阻止详情和平铺表格的交易入口，但表格历史保持可用', t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const { state } = scope.run(() => setup('./EquityTrading.vue', { design: 'focus', orderReview: false }))
  const event = { currentTarget: { isConnected: false } }
  const position = state.records.value.positions[0]
  const order = state.demoOrders.value.find(row => !orderActions.orderActionReason(row))
  const rejected = state.demoOrders.value.find(orderActions.canConvertOrder)
  state.systemRunning.value = false
  state.openDetail('positions', position, 1, event)
  for (const action of ['new', 'chase', 'close']) {
    state.openFocusAction({ action, event })
    assert.equal(vue.toRaw(state.selectedRecord.value.row), position)
    assert.equal(state.orderEntryContext.value, null)
    assert.equal(state.isActionVisible.value, false)
  }
  for (const [kind, record, action] of [['positions', position, 'close'], ['orders', order, 'amend'], ['orders', order, 'cancel'], ['orders', rejected, 'convert']]) {
    state.openTableAction(kind, { record, action, event })
    assert.equal(state.orderEntryContext.value, null)
    assert.equal(state.operationContext.value, null)
  }
  state.openTableAction('orders', { record: order, action: 'history', event })
  assert.equal(state.historyVisible.value, true)
  assert.deepEqual(state.historyContext.value, { kind: 'orders', record: order })
})

test('新版在确认前暂停会拦截撤改单且不改变订单，恢复后沿用原订单操作规则', t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const { state } = scope.run(() => setup('./EquityTrading.vue', { design: 'focus', orderReview: false }))
  const row = state.demoOrders.value.find(item => !orderActions.orderActionReason(item))
  state.openTableAction('orders', { record: row, action: 'cancel', event: { currentTarget: {} } })
  assert.equal(state.operationVisible.value, true)
  const before = JSON.stringify(state.demoOrders.value)
  state.systemRunning.value = false
  state.confirmOperation({})
  assert.match(state.operationError.value, /系统已中断/)
  const replies = []
  state.confirmAmendment({ orderId: row.id }, reply => replies.push(reply))
  assert.equal(replies.length, 1)
  assert.match(replies[0].error, /系统已中断/)
  assert.equal(JSON.stringify(state.demoOrders.value), before)
  state.systemRunning.value = true
  state.confirmOperation({})
  assert.match(state.operationResult.value, /已撤回未成交部分/)
  assert.ok(['撤单', '部撤'].includes(row.status))
})
