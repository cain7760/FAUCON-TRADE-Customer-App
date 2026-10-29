import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import { formatNumber } from './model.js'
import { orderBookLevels } from './orderModel.js'
import { pricePrecision } from './orderCalculations.js'

function setup(symbol, environment = {}) {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderBook.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'mobile-book-layout-test' }).content
  const imports = { ...vue, formatNumber, orderBookLevels, pricePrecision, ...environment }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  const props = vue.reactive({ symbol })
  return { props, book: component.setup(props, { expose() {} }) }
}

test('盘口数量十万起使用 k，保留到股且不改变底层数量', () => {
  const scope = vue.effectScope()
  const { book } = scope.run(() => setup({ code: '000001', price: 11.78 }))
  const originalLevels = structuredClone(book.levels.value)
  for (const [value, expected] of [[0, '0'], [40200, '40,200'], [99999, '99,999'], [100000, '100k'], [100001, '100.001k'], [125500, '125.5k'], [1000000, '1,000k'], [undefined, '--'], [null, '--'], [NaN, '--'], [Infinity, '--']]) {
    assert.equal(book.number(value), expected)
  }
  assert.deepEqual(book.levels.value, originalLevels)
  assert.equal(book.number(128003), '128.003k', '转换为 k 不应因浮点截断丢失一股')
  scope.stop()
})

test('盘口滚动到边界或五档不溢出时可继续滚动正文，弹窗外层仍隔离背景', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  const inner = css.match(/^\.ticket-book-depths\s*\{([^}]+)\}/m)[1]
  const outer = css.match(/^\.order-entry-scroll\s*\{([^}]+)\}/m)[1]
  assert.match(inner, /overscroll-behavior-y:\s*auto/)
  assert.doesNotMatch(inner, /overscroll-behavior(?:-y)?:\s*contain/)
  assert.match(outer, /overscroll-behavior:\s*contain/)
})

test('紧凑盘口分隔线上下各留 11px，基线档位切换占满盘口且隐藏标题', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /\.ticket-compact-book-depths\s*\{[^}]*gap:\s*23px/)
  assert.match(css, /\.ticket-compact-book-side \+ \.ticket-compact-book-side::before\s*\{[^}]*inset:\s*-12px 0 auto;[^}]*border-top:\s*1px/)
  assert.doesNotMatch(css, /\.ticket-compact-book-side \+ \.ticket-compact-book-side\s*\{[^}]*padding-top:/)
  assert.match(css, /\.ticket-trading-stack--baseline \.ticket-book > header > h3\s*\{[^}]*display:\s*none/)
  assert.match(css, /\.ticket-trading-stack--baseline \.ticket-book > header > \.ticket-segment\s*\{[^}]*width:\s*100%/)
})

test('盘口每档高度统一 24px，触屏分支不再放大行高', () => {
  const css = readFileSync(new URL('./order-entry.css', import.meta.url), 'utf8')
  assert.match(css, /--ticket-book-row-height:\s*24px/)
  assert.doesNotMatch(css, /--ticket-book-row-height:\s*(?!24px)[0-9]+px/)
  assert.doesNotMatch(css, /\.ticket-book \.ticket-book-level\s*\{[^}]*min-height:\s*44px/)
})

test('盘口可见高度跟随五/十档选择，不再把十档限制在五档高度', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderBook.vue', import.meta.url), 'utf8'))
  const book = descriptor.template.ast.children.find(node => node.tag === 'section')
  const binding = book.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'style')
  assert.equal(binding.exp.content, "{ '--ticket-book-visible-levels': depth }")
})

test('盘口只显示买卖双列，同一个滚动容器内左右并排，无重复标的行情', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderBook.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const book = nodes.find(node => attribute(node, 'class') === 'ticket-book ticket-module')
  assert.ok(!nodes.some(node => attribute(node, 'class') === 'ticket-book-instrument'))
  const headings = nodes.find(node => attribute(node, 'class') === 'ticket-book-headings')
  const scroll = nodes.find(node => attribute(node, 'class') === 'ticket-book-depths')
  assert.ok(book.children.indexOf(headings) < book.children.indexOf(scroll))
  const depths = nodes.filter(node => attribute(node, 'class') === 'ticket-book-depth')
  const siblings = scroll.children.filter(node => node.type === 1)
  assert.equal(siblings.indexOf(depths[1]), siblings.indexOf(depths[0]) + 1)
})

test('双边盘口默认五档，两侧由一档顺序排列，切十档不改原始价格数量', async () => {
  const scope = vue.effectScope()
  const symbol = { code: '000001', market: 'SZ', price: 11.78, cost: 11.7, change: .68 }
  const { book } = scope.run(() => setup(symbol))
  assert.deepEqual(book.levels.value, orderBookLevels(symbol, 5))
  assert.deepEqual(book.displayLevels.value.map(row => row.rank), [1, 2, 3, 4, 5])
  assert.equal(book.levels.value[0].ask, 11.79)
  assert.equal(book.levels.value[0].bid, 11.78)
  const firstFive = book.levels.value
  book.depth.value = 10
  await vue.nextTick()
  assert.deepEqual(book.levels.value, orderBookLevels(symbol, 10))
  assert.deepEqual(book.levels.value.slice(0, 5), firstFive)
  assert.equal(book.displayLevels.value.length, 10)
  assert.equal(book.fillWidth(book.maximumQuantity.value), '100%')
  assert.equal(book.fillWidth(undefined), '0%')
  scope.stop()
})

test('无标的、无参考价和手动标的保留占位档位，不虚构价格与数量', async () => {
  const scope = vue.effectScope()
  const { props, book } = scope.run(() => setup(undefined))
  for (const symbol of [undefined, { code: 'NOQUOTE', price: 0 }, { code: 'MANUAL', price: 10, isManual: true }]) {
    props.symbol = symbol
    await vue.nextTick()
    assert.deepEqual(book.levels.value, [])
    assert.deepEqual(book.displayLevels.value, Array.from({ length: 5 }, (_, index) => ({ rank: index + 1 })))
    assert.equal(book.money(book.displayLevels.value[0].ask), '--')
    assert.equal(book.number(book.displayLevels.value[0].askQuantity), '--')
  }
  scope.stop()
})

test('空盘口可切换五档十档，选择、清空与重选时保持档位且无旧行情残留', async () => {
  const scope = vue.effectScope()
  const { props, book } = scope.run(() => setup(undefined))
  book.depth.value = 10
  await vue.nextTick()
  assert.equal(book.displayLevels.value.length, 10)
  props.symbol = { code: '000001', market: 'SZ', price: 11.78 }
  await vue.nextTick()
  assert.deepEqual(book.displayLevels.value, orderBookLevels(props.symbol, 10))
  props.symbol = null
  await vue.nextTick()
  assert.equal(book.displayLevels.value.length, 10)
  assert.ok(book.displayLevels.value.every(row => Object.keys(row).length === 1))
  props.symbol = { code: '600519', market: 'SH', price: 1456 }
  await vue.nextTick()
  assert.deepEqual(book.displayLevels.value, orderBookLevels(props.symbol, 10))
  scope.stop()
})

test('盘口表头与买卖档位不随空行情隐藏，空档按钮不可点价', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderBook.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const binding = (node, name) => node.props?.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name)?.exp?.content
  const nodes = elements(descriptor.template.ast)
  for (const node of nodes.filter(node => ['ticket-book-headings', 'ticket-book-depths', 'ticket-book-depth'].includes(attribute(node, 'class')))) {
    const condition = node.props.find(prop => prop.type === 7 && prop.name === 'if')
    if (condition) assert.equal(condition.exp.content, '!compact')
  }
  const buttons = nodes.filter(node => attribute(node, 'class')?.startsWith('ticket-book-level '))
  assert.equal(buttons.length, 2)
  for (const button of buttons) assert.equal(binding(button, 'disabled'), '!levels.length')
})

test('方案 B 窄版盘口卖盘倒序在上、买盘正序在下，不更改报价或空态数据', async () => {
  const scope = vue.effectScope(), { props, book } = scope.run(() => setup({ code: '000001', price: 11.78 }))
  assert.deepEqual(book.compactSides.value.map(side => side.key), ['sell', 'buy'])
  assert.deepEqual(book.compactSides.value[0].rows.map(row => row.rank), [5, 4, 3, 2, 1])
  assert.equal(book.compactSides.value[0].rows.at(-1).ask, 11.79)
  assert.equal(book.compactSides.value[1].rows[0].bid, 11.78)
  book.depth.value = 10; await vue.nextTick()
  assert.deepEqual(book.compactSides.value[0].rows.map(row => row.rank), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  props.symbol = null; await vue.nextTick()
  assert.ok(book.compactSides.value.every(side => side.rows.length === 10 && side.rows.every(row => row[side.price] === undefined && row[side.quantity] === undefined)))
  scope.stop()
})

test('买卖共享滚动，标的或档位改变时回到最近一档，主动滚动不会被打断', async () => {
  const scope = vue.effectScope()
  const { book, props } = scope.run(() => setup({ code: '000001', price: 11.78 }))
  const first = { scrollTop: 56 }
  book.depthList.value = first
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(first.scrollTop, 0)
  first.scrollTop = 56
  await vue.nextTick()
  assert.equal(first.scrollTop, 56)
  book.depth.value = 10
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(first.scrollTop, 0)
  first.scrollTop = 84
  props.symbol = { code: '600519', price: 1456 }
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(first.scrollTop, 0)
  scope.stop()
})
