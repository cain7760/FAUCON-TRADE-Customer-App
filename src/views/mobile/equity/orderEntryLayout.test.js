import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'

test('默认盘口左参数右，A 通过预览参数保留上下布局，仅重排中间工作区', () => {
  const source = readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8')
  assert.match(source, /layout: \{ type: String, default: 'split' \}/)
  assert.match(source, /'ticket-trading-stack--split': layout === 'split'/)
  assert.match(source, /:compact="layout === 'split'"/)
  const app = readFileSync(new URL('../../../App.vue', import.meta.url), 'utf8')
  assert.match(app, /get\('orderLayout'\) === 'stacked' \? 'stacked' : 'split'/)
  for (const path of ['../CustomerMobileApp.vue', './EquityTrading.vue']) {
    assert.match(readFileSync(new URL(path, import.meta.url), 'utf8'), /:(?:order-)?layout="orderLayout"/)
  }
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-trading-stack--split\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /\.ticket-trading-stack--split\.ticket-trading-stack--baseline\s*\{[^}]*grid-template-columns:\s*minmax\(0, 132px\) minmax\(0, 1fr\)/)
  assert.match(css, /\.ticket-trading-stack--baseline \.ticket-compact-book-headings\s*\{[^}]*line-height:\s*16px/)
  assert.match(css, /\.ticket-trading-stack--split > \.ticket-order-form\s*\{[^}]*grid-column:\s*2/)
  assert.match(css, /\.ticket-trading-stack--split > \.ticket-book\s*\{[^}]*grid-column:\s*1/)
  assert.doesNotMatch(css, /\.ticket-trading-stack--split[^{}]*(?:ticket-order-context|ticket-order-actions|order-sheet-heading)\s*\{/)
})

test('App 评审入口保留现版和新版，并可进入共用应用实例的下单 A/B 评审', () => {
  const app = readFileSync(new URL('../../../App.vue', import.meta.url), 'utf8')
  assert.match(app, /get\('appReview'\) === '1'/)
  assert.match(app, /<EquityAppReview v-else-if="isAppReview"/)
  assert.match(app, /get\('orderReview'\) === '1'/)
  assert.match(app, /<OrderLayoutReview v-else-if="isOrderReview" :initial-layout="orderLayout"/)
  const appReview = readFileSync(new URL('../EquityAppReview.vue', import.meta.url), 'utf8')
  assert.match(appReview, /@click="design = 'baseline'"/)
  assert.match(appReview, /@click="design = 'focus'"/)
  assert.match(appReview, /@click="design = 'c'"/)
  assert.match(app, /\['baseline', 'focus', 'c'\]\.includes/)
  assert.match(appReview, /<KeepAlive><CustomerMobileApp :key="design" :design="design" app-review \/><\/KeepAlive>/)
  assert.match(appReview, /href="\?orderReview=1"/)
  const review = readFileSync(new URL('../OrderLayoutReview.vue', import.meta.url), 'utf8')
  assert.match(review, /value: 'stacked', label: 'A 上下'/)
  assert.match(review, /value: 'split', label: 'B 左右'/)
  assert.match(review, /@click="layout = option.value"/)
  assert.match(review, /<CustomerMobileApp :order-layout="layout" order-review \/>/)
  assert.doesNotMatch(review, /<CustomerMobileApp[^>]*:key=/)
  const trading = readFileSync(new URL('./EquityTrading.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(trading, /aria-label="App方案评审"/)
  assert.match(trading, /isActionVisible = ref\(props.orderReview\)/)
})

test('订单类型切换受隐藏开关控制，改单概览仍只在改单时显示', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const execution = nodes.find(node => attribute(node, 'aria-label') === '订单类型')
  const original = nodes.find(node => attribute(node, 'class') === 'ticket-amend-original')
  assert.equal(execution.props.find(prop => prop.type === 7 && prop.name === 'if')?.exp?.content, 'isExecutionSwitchVisible && !isAmend')
  assert.equal(original.props.find(prop => prop.type === 7 && prop.name === 'if')?.exp?.content, 'isAmend')
  assert.ok(!original.props.some(prop => prop.type === 7 && prop.name === 'else'))
})

test('盘口位于参数上方，价格数量并排，交易操作和四个预估固定于滚动区外', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const body = nodes.find(node => attribute(node, 'class') === 'order-entry-scroll ticket-workspace')
  const columns = elements(body).find(node => attribute(node, 'class') === 'ticket-trading-stack')
  const panes = columns.children.filter(node => node.type === 1)
  const form = panes.find(node => attribute(node, 'class') === 'ticket-order-form ticket-module')
  const book = panes.find(node => node.tag === 'EquityOrderBook')
  assert.ok(panes.indexOf(book) < panes.indexOf(form))
  const pair = elements(form).find(node => attribute(node, 'class') === 'ticket-input-pair')
  assert.equal(pair.children.filter(node => node.tag === 'section').length, 2)
  const fields = elements(form).find(node => attribute(node, 'class') === 'ticket-order-fields')
  const capacity = elements(fields).find(node => attribute(node, 'aria-label') === '下单可用数量')
  assert.ok(capacity)
  assert.equal(capacity.children.filter(node => node.tag === 'div').length, 2)
  const actions = nodes.find(node => attribute(node, 'class') === 'ticket-order-actions ticket-module')
  assert.ok(!elements(body).includes(actions))
  assert.ok(!elements(columns).includes(actions))
  assert.ok(actions.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'class' && prop.exp?.content.includes('!showBuy || !showSell')))
  const children = actions.children.filter(node => node.type === 1)
  const buttonsIndex = children.findIndex(node => attribute(node, 'class') === 'ticket-trade-buttons')
  const estimatesIndex = children.findIndex(node => attribute(node, 'aria-label') === '订单预估')
  assert.ok(buttonsIndex < estimatesIndex)
  const estimateColumns = children[estimatesIndex].children.filter(node => node.tag === 'dl')
  assert.deepEqual(estimateColumns.map(node => attribute(node, 'aria-label')), ['买入预估', '卖出预估'])
  assert.equal(estimateColumns.reduce((count, node) => count + node.children.filter(child => child.tag === 'div').length, 0), 4)
  assert.ok(!elements(actions).includes(capacity))
  assert.ok(!elements(fields).includes(actions))
  const summaryFooter = nodes.find(node => attribute(node, 'class') === 'ticket-summary-footer')
  assert.ok(elements(summaryFooter).some(node => node.tag === 'EquityAccountSummary'))
  assert.ok(children.indexOf(summaryFooter) > estimatesIndex)
  assert.ok(!elements(body).includes(summaryFooter))
})

test('四个核心模块有独立语义边界，参数包含容量，操作包含预估，资产概要独立辅助', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const context = nodes.find(node => attribute(node, 'aria-label') === '下单标的与行情')
  const parameters = nodes.find(node => attribute(node, 'aria-label') === '下单参数')
  const actions = nodes.find(node => attribute(node, 'aria-label') === '交易操作与预估')
  for (const node of [context, parameters, actions]) {
    assert.equal(node.tag, 'section')
    assert.ok(attribute(node, 'class').split(' ').includes('ticket-module'))
  }
  assert.ok(!elements(parameters).some(node => node.tag === 'h3'))
  assert.ok(elements(parameters).some(node => attribute(node, 'aria-label') === '下单可用数量'))
  assert.ok(!elements(parameters).some(node => attribute(node, 'aria-label') === '订单预估'))
  assert.ok(elements(actions).some(node => attribute(node, 'aria-label') === '订单预估'))
  assert.ok(elements(actions).some(node => node.tag === 'EquityAccountSummary'))
  const { descriptor: book } = parse(readFileSync(new URL('./EquityOrderBook.vue', import.meta.url), 'utf8'))
  const bookModule = elements(book.template.ast).find(node => attribute(node, 'aria-label') === '盘口')
  assert.equal(bookModule.tag, 'section')
  assert.ok(attribute(bookModule, 'class').split(' ').includes('ticket-module'))
})

test('四个模块平铺，不添加独立背景、圆角、外框或阴影', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  for (const name of ['ticket-module', 'ticket-order-context', 'ticket-order-actions', 'ticket-book']) {
    const rule = css.match(new RegExp(`\\.${name}\\s*\\{([^}]+)\\}`))
    assert.ok(rule, `${name} 应有模块布局规则`)
    assert.doesNotMatch(rule[1], /(?:^|;)\s*(?:background(?:-color)?|border|border-radius|box-shadow|outline(?:-offset)?)\s*:/)
  }
})

test('账户标的模块移除底部分隔线，容量和预估统一辅助指标字号', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  const context = css.match(/\.ticket-order-context\s*\{([^}]+)\}/)[1]
  assert.doesNotMatch(context, /border(?:-bottom)?\s*:/)
  assert.match(context, /margin-bottom:\s*16px/)
  assert.match(context, /padding-bottom:\s*0/)
  const labels = css.match(/\.ticket-estimates dt\s*\{([^}]+)\}/)[1]
  const values = css.match(/\.ticket-estimates dd\s*\{([^}]+)\}/)[1]
  assert.match(labels, /font-size:\s*12px/)
  assert.match(values, /font-size:\s*12px/)
  assert.match(values, /font-family:\s*var\(--app-font-family-numeric\)/)
  assert.match(values, /white-space:\s*nowrap/)
  assert.doesNotMatch(css, /\.ticket-order-actions \.ticket-estimate-column dd\s*\{/)
})

test('标的搜索提示复用输入框占位文字的次级颜色', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const placeholder = elements(descriptor.template.ast).find(node => node.props?.some(prop => prop.type === 6 && prop.name === 'class' && prop.value?.content === 'ticket-symbol-placeholder'))
  assert.ok(placeholder?.props.some(prop => prop.type === 7 && prop.name === 'else'))
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  const inputColor = css.match(/\.equity-order-sheet input::placeholder[^{}]*\{[^}]*color:\s*([^;]+);/)[1]
  const symbolColor = css.match(/\.ticket-symbol-placeholder\s*\{[^}]*color:\s*([^;]+);/)[1]
  assert.equal(symbolColor, inputColor)
})

test('图稿主面板输入 44px、固定买卖按钮 48px，算法弹窗不缩小', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  const input = css.match(/\.ticket-reference-layout \.ticket-number-control\s*\{([^}]+)\}/)[1]
  const trade = css.match(/\.ticket-trade-buttons button\s*\{([^}]+)\}/)[1]
  const settings = css.match(/\.ticket-settings :is\(select, input\)\s*\{([^}]+)\}/)[1]
  assert.match(input, /height:\s*44px/)
  assert.match(trade, /min-height:\s*48px/)
  assert.match(settings, /min-height:\s*44px/)
  assert.match(css, /\.ticket-reference-layout \.ticket-quantity-control \.ticket-size-value input\s*\{[^}]*padding:\s*0 2px 0 8px/)
})

test('主表单标题56px、市价金色、容量36px算法44px，算法在滑块前且数量左内边距8px', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /\.ticket-account button|\.ticket-header-account button/)
  assert.match(css, /\.ticket-reference-layout > \.order-sheet-heading\s*\{[^}]*min-height:\s*56px/)
  assert.match(css, /\.ticket-entry-sheet \.order-sheet-heading\s*\{[^}]*min-height:\s*48px/)
  assert.match(css, /\.ticket-reference-layout \.ticket-market-price\s*\{[^}]*color:\s*var\(--app-color-accent\)/)
  assert.match(css, /\.ticket-capacity > div\s*\{[^}]*min-height:\s*36px/)
  const algorithm = css.match(/\.ticket-algorithm-row > button\s*\{([^}]+)\}/)[1]
  assert.match(algorithm, /min-height:\s*44px/)
  assert.doesNotMatch(algorithm, /(?:^|;)\s*height:/)
  assert.match(css, /\.ticket-algorithm-heading\s*\{[^}]*min-height:\s*26px/)
  assert.match(css, /\.ticket-reference-layout \.ticket-quantity-control \.ticket-size-value input\s*\{[^}]*padding:\s*0 2px 0 8px;\s*text-align:\s*left/)
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const fields = elements(descriptor.template.ast).find(node => attribute(node, 'class') === 'ticket-order-fields')
  const children = fields.children.filter(node => node.type === 1)
  const index = name => children.findIndex(node => attribute(node, 'class') === name)
  assert.ok(index('ticket-input-pair') < index('ticket-algorithm-row'))
  assert.ok(index('ticket-algorithm-row') < index('ticket-fractions'))
  assert.ok(index('ticket-fractions') < index('ticket-estimates ticket-capacity'))
})

test('下单抽屉复用现有滑动标识和标题规范，万单位仅复用输入背景', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  const shared = readFileSync(new URL('./equity.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /\.ticket-reference-layout > \.sheet-handle\s*\{[^}]*display:\s*none/)
  assert.match(shared, /\.sheet-handle\s*\{[^}]*width:\s*32px;\s*height:\s*4px;[^}]*margin:\s*10px auto 0/)
  assert.match(css, /\.ticket-reference-layout\.van-popup\s*\{[^}]*border-radius:\s*4px 4px 0 0/)
  assert.match(css, /\.ticket-reference-layout > \.order-sheet-heading\s*\{[^}]*padding:\s*0 16px/)
  assert.match(css, /\.ticket-entry-sheet \.order-sheet-heading h2\s*\{[^}]*font-size:\s*18px/)
  assert.match(shared, /\.sheet-heading h2\s*\{[^}]*font-size:\s*18px/)
  assert.match(css, /\.ticket-reference-layout \.ticket-unit-trigger:is\(\.is-wan-unit, \[aria-expanded="true"\]\)\s*\{[^}]*background-color:\s*transparent/)
})

test('币种与 IA 标签共用字号高度，组合输入的焦点环只由外层绘制', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  const tags = css.match(/\.ticket-symbol-tags > :is\(b, span\)\s*\{([^}]+)\}/)[1]
  assert.match(tags, /height:\s*18px/)
  assert.match(tags, /font-size:\s*11px/)
  assert.match(tags, /padding:\s*0 4px/)
  const ring = css.match(/:is\(\.ticket-number-control, \.ticket-percentage-control, \.ticket-symbol-control\):focus-within\s*\{([^}]+)\}/)[1]
  assert.match(ring, /outline:\s*1px solid var\(--app-color-accent\)/)
  assert.match(ring, /outline-offset:\s*0/)
  assert.ok(css.includes('.equity-order-sheet :is(.ticket-number-control, .ticket-percentage-control, .ticket-symbol-control) :is(input, select, button):focus-visible { outline: none; }'))
  assert.ok(css.includes('.ticket-number-control.has-error:focus-within { outline-color: var(--app-color-rise); }'))
})

test('账户进入标题行，标的选择区集中名称代码、标签及唯一行情', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const context = nodes.find(node => attribute(node, 'aria-label') === '下单标的与行情')
  const header = nodes.find(node => attribute(node, 'class') === 'order-sheet-heading')
  assert.ok(elements(header).some(node => attribute(node, 'class') === 'ticket-account ticket-header-account'))
  assert.ok(elements(context).some(node => attribute(node, 'class') === 'ticket-symbol-control'))
  assert.ok(elements(context).some(node => attribute(node, 'class') === 'ticket-symbol-tags'))
  assert.equal(nodes.filter(node => attribute(node, 'aria-label') === '标的参考行情').length, 1)
  const slider = nodes.find(node => node.tag === 'input' && attribute(node, 'type') === 'range')
  assert.equal(attribute(slider, 'aria-label'), '下单比例')
  assert.equal(attribute(slider, 'min'), '0')
  assert.equal(attribute(slider, 'max'), '100')
  assert.equal(attribute(slider, 'step'), '1')
  assert.ok(slider.props.some(prop => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'input' && prop.exp?.content === 'selectFraction($event.target.value)'))
  assert.ok(slider.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'disabled' && prop.exp?.content === '!symbol'))
  const marks = nodes.find(node => attribute(node, 'class') === 'ticket-fraction-marks')
  assert.equal(attribute(marks, 'aria-hidden'), undefined)
  const shortcut = elements(marks).find(node => node.tag === 'button')
  assert.ok(shortcut.props.some(prop => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'click' && prop.exp?.content === 'selectFraction(value)'))
  assert.ok(shortcut.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'disabled' && prop.exp?.content === '!symbol'))
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-fractions\s*\{[^}]*height:\s*28px/)
  assert.doesNotMatch(css, /\.ticket-fractions button\s*\{/)
})

test('算法使用独立居中弹窗，原表单保持渲染且背景隔离', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const binding = (node, name) => node.props?.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name)?.exp?.content
  const nodes = elements(descriptor.template.ast)
  const main = nodes.find(node => attribute(node, 'class') === 'equity-filter-sheet equity-order-sheet ticket-entry-sheet')
  const dialog = nodes.find(node => attribute(node, 'class') === 'equity-order-sheet equity-algorithm-dialog ticket-entry-sheet')
  assert.equal(dialog.tag, 'van-popup')
  assert.equal(attribute(dialog, 'position'), 'center')
  assert.equal(binding(dialog, 'show'), "show && page === 'algorithm'")
  assert.ok(!elements(main).includes(dialog))
  assert.equal(binding(main, 'inert'), "page === 'algorithm' ? true : undefined")
  assert.equal(binding(main, 'aria-hidden'), "page === 'algorithm' ? 'true' : undefined")
  assert.ok(elements(main).some(node => node.props?.some(prop => prop.type === 7 && prop.name === 'if' && prop.exp?.content === "page === 'form' || page === 'algorithm'")))
  assert.ok(elements(dialog).some(node => attribute(node, 'aria-label') === '关闭执行算法弹窗'))
})

test('标题栏不显示账户辅助字，账户胶囊紧邻关闭按钮且保留完整可访问名称', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const header = nodes.find(node => attribute(node, 'class') === 'order-sheet-heading')
  const account = nodes.find(node => attribute(node, 'class') === 'ticket-account ticket-header-account')
  assert.deepEqual(account.children.filter(node => node.type === 1).map(node => node.tag), ['EquityAccountTrigger'])
  const children = header.children.filter(node => node.type === 1)
  assert.equal(children.indexOf(account), children.length - 2)
  const button = account.children.find(node => node.tag === 'EquityAccountTrigger')
  assert.ok(button.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'aria-label' && prop.exp?.content.includes('accountLabel(accountId)')))
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /\.ticket-account button|\.ticket-header-account button/)
  assert.match(css, /\.ticket-reference-layout > \.order-sheet-heading > \.equity-icon-button:last-child\s*\{\s*margin-left:\s*0/)
})

test('价格和数量仅局部统一 4px 圆角，单位与输入间隔 8px，盘口切换高 24px', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-reference-layout \.ticket-number-control\s*\{[^}]*border-radius:\s*4px/)
  assert.match(css, /\.ticket-reference-layout \.ticket-market-price\s*\{[^}]*border-radius:\s*4px/)
  assert.match(css, /\.ticket-reference-layout \.ticket-unit-trigger\s*\{[^}]*margin-left:\s*8px/)
  assert.match(css, /\.ticket-book \.ticket-segment button\s*\{[^}]*min-height:\s*24px/)
})

test('标的参数不再写死在模板，空标的保留每手数量占位', () => {
  const source = readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /<span>40% IA<\/span>/)
  assert.match(source, /symbol \? `\$\{estimate\.lot\}股\/手` : '--'/)
  assert.match(source, /\{\{ symbolIaLabel \}\}/)
})

test('算法入口整行可点，当前算法及 POV 参数摘要分层且关联可访问描述', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const row = elements(descriptor.template.ast).find(node => attribute(node, 'class') === 'ticket-algorithm-row')
  const button = row.children.find(node => node.tag === 'button' && attribute(node, 'aria-haspopup') === 'dialog')
  assert.ok(button.props.some(prop => prop.type === 7 && prop.name === 'else'))
  assert.ok(button.props.some(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'aria-describedby'))
  const summary = elements(button).find(node => attribute(node, 'id') === 'ticket-algorithm-summary')
  assert.ok(summary.props.some(prop => prop.type === 7 && prop.name === 'if' && prop.exp?.content === "draft.algorithm === 'POV'"))
  assert.equal(summary.children.filter(node => node.tag === 'span').length, 2)
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-algorithm-row > button\s*\{[^}]*width:\s*100%/)
  assert.match(css, /\.ticket-algorithm-summary\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
})

test('基线算法下拉选择，仅 POV 弹窗配置；其他方案保留完整配置入口', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const binding = (node, name) => node.props?.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name)?.exp?.content
  const nodes = elements(descriptor.template.ast)
  const row = nodes.find(node => attribute(node, 'class') === 'ticket-algorithm-row')
  assert.ok(!nodes.some(node => attribute(node, 'class') === 'ticket-algorithm-direct'))
  const menu = elements(row).find(node => node.tag === 'van-popover')
  assert.ok(menu.props.some(prop => prop.type === 7 && prop.name === 'if' && prop.exp?.content === "design === 'baseline'"))
  const select = elements(menu).find(node => attribute(node, 'class') === 'ticket-algorithm-select')
  assert.equal(attribute(select, 'aria-haspopup'), 'menu')
  assert.ok(elements(select).some(node => attribute(node, 'class') === 'ticket-pov-tag app-numeric'))
  const trigger = row.children.find(node => node.tag === 'button')
  assert.equal(attribute(trigger, 'aria-haspopup'), 'dialog')
  assert.ok(trigger.props.some(prop => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'click' && prop.exp?.content === "navigate('algorithm', $event)"))
  const dialog = nodes.find(node => attribute(node, 'class') === 'equity-order-sheet equity-algorithm-dialog ticket-entry-sheet')
  assert.equal(binding(dialog, 'show'), "show && page === 'algorithm'")
  assert.ok(elements(dialog).some(node => node.tag === 'van-tab' && node.props.some(prop => prop.type === 7 && prop.name === 'for' && prop.exp?.content === 'option in algorithmDialogOptions')))
  const confirm = elements(dialog).find(node => node.tag === 'button' && attribute(node, 'class') === 'ticket-primary')
  assert.equal(binding(confirm, 'disabled'), "algorithmDraft.value === 'POV' && !validPov(algorithmDraft)")
})

test('基线概要栏压缩上下留白但保留 36px 触控标题行', () => {
  const source = readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8')
  assert.match(source, /'ticket-baseline-order-entry': design === 'baseline'/)
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-baseline-order-entry \.ticket-summary-footer\s*\{[^}]*padding-top:\s*4px/)
  assert.match(css, /\.ticket-baseline-order-entry \.ticket-summary-footer \.ticket-account-summary\s*\{[^}]*padding-top:\s*2px/)
  assert.match(readFileSync(new URL('./EquityAccountSummary.vue', import.meta.url), 'utf8'), /\.ticket-account-summary-heading\s*\{[^}]*min-height:\s*36px/)
})

test('下单分段及算法 Tab 统一灰色外框和金色选中描边，保留键盘焦点', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  for (const selector of ['.ticket-reference-layout .ticket-segment', '.ticket-algorithm-tabs .van-tabs__nav--card']) {
    const rule = css.split(selector + ' {')[1]?.split('}')[0]
    assert.match(rule, /border:\s*1px solid var\(--app-color-frame\)/)
    assert.match(rule, /background:\s*var\(--app-color-control\)/)
  }
  for (const selector of ['.ticket-reference-layout .ticket-segment button[aria-pressed="true"]', '.ticket-algorithm-tabs .van-tab--active']) {
    const rule = css.split(selector + ' {')[1]?.split('}')[0]
    assert.match(rule, /outline:\s*1px solid var\(--app-color-accent\)/)
    assert.match(rule, /background:\s*var\(--app-color-accent-soft\)/)
    assert.match(rule, /color:\s*var\(--app-color-accent\)/)
  }
  assert.match(css, /\.ticket-reference-layout \.ticket-segment button:focus-visible\s*\{[^}]*outline:\s*2px/)
  assert.match(css, /\.ticket-algorithm-tabs \[role="tab"\]:focus-visible\s*\{[^}]*outline:/)
})

test('分段只有两端保留外角，中间连接处为直角；算法入口复用标的底色与描边', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  for (const selector of ['.ticket-reference-layout .ticket-segment button', '.ticket-algorithm-tabs .van-tab--card']) {
    assert.match(css.split(selector + ' {')[1].split('}')[0], /border-radius:\s*0/)
    assert.match(css.split(selector + ':first-child {')[1].split('}')[0], /border-radius:\s*3px 0 0 3px/)
    assert.match(css.split(selector + ':last-child {')[1].split('}')[0], /border-radius:\s*0 3px 3px 0/)
  }
  for (const selector of ['.ticket-symbol-control', '.ticket-algorithm-row > button']) {
    const rule = css.split(selector + ' {')[1].split('}')[0]
    assert.match(rule, /background:\s*var\(--app-color-background\)/)
    assert.match(rule, /border:\s*1px solid var\(--app-color-border\)/)
    assert.match(rule, /border-radius:\s*4px/)
  }
})

test('标注间距、盘口端角和容量分隔线仅作用于对应控件', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-reference-layout \.ticket-unit-trigger\s*\{[^}]*margin-right:\s*8px/)
  assert.match(css, /\.ticket-fractions\s*\{[^}]*margin-top:\s*6px/)
  assert.match(css, /\.ticket-book \.ticket-segment button:first-child\s*\{[^}]*border-radius:\s*2px 0 0 2px/)
  assert.doesNotMatch(css.match(/\.ticket-capacity > div\s*\{([^}]+)\}/)[1], /border-bottom/)
  const source = readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /mobile-order-percent|editPercentage|isPercent/)
})

test('数量与金额框移除加减按钮，单位仍可选且字号 14px，价格保留步进', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const quantity = nodes.find(node => attribute(node, 'class') === 'ticket-number-control ticket-quantity-control')
  assert.equal(elements(quantity).filter(node => node.tag === 'select').length, 0)
  const popover = elements(quantity).find(node => node.tag === 'van-popover')
  assert.equal(attribute(popover, 'placement'), 'bottom-end')
  assert.equal(attribute(popover, 'trigger'), 'manual')
  assert.ok(elements(popover).some(node => attribute(node, 'role') === 'menuitemradio'))
  const trigger = elements(popover).find(node => attribute(node, 'class') === 'ticket-unit-trigger')
  assert.equal(attribute(trigger, 'aria-haspopup'), 'menu')
  const price = nodes.find(node => attribute(node, 'class') === 'ticket-number-control ticket-price-control')
  assert.equal(elements(price).filter(node => node.tag === 'button').length, 2)
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-reference-layout \.ticket-unit-trigger\s*\{[^}]*font-size:\s*14px/)
})
