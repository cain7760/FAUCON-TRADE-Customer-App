import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'

test('最大可买卖留在表单，四个预估字段位于买卖按钮和资产概要之间', () => {
  const { descriptor } = parse(readFileSync(new URL('./EquityOrderEntry.vue', import.meta.url), 'utf8'))
  const elements = node => [node, ...(node.children || []).flatMap(elements)]
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = elements(descriptor.template.ast)
  const body = nodes.find(node => attribute(node, 'class') === 'order-entry-scroll')
  const capacity = elements(body).find(node => attribute(node, 'aria-label') === '下单可用数量')
  assert.ok(capacity)
  assert.equal(capacity.children.filter(node => node.tag === 'div').length, 2)
  const footer = nodes.find(node => node.tag === 'footer' && attribute(node, 'class') === 'ticket-footer')
  const children = footer.children.filter(node => node.type === 1)
  const buttonsIndex = children.findIndex(node => attribute(node, 'class') === 'ticket-trade-buttons')
  const estimatesIndex = children.findIndex(node => attribute(node, 'aria-label') === '订单预估')
  const summaryIndex = children.findIndex(node => node.tag === 'EquityAccountSummary')
  assert.ok(buttonsIndex < estimatesIndex && estimatesIndex < summaryIndex)
  assert.equal(children[estimatesIndex].children.filter(node => node.tag === 'div').length, 4)
  assert.ok(!elements(footer).includes(capacity))
})
