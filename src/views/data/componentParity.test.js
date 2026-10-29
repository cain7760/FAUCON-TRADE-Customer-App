import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canConvertOrder, orderStatuses } from '../mobile/equity/orderStatus.js'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
test('App 历史实际复用权益筛选、表格、状态，按要求移除更多操作入口', () => {
  const source = read('../mobile/equity/EquityHistoricalData.vue')
  for (const component of ['EquityFilters', 'EquityRecordsTable']) assert.ok(source.includes('<' + component))
  assert.doesNotMatch(source, /EquityFocusTools|focus-more-button/)
  assert.doesNotMatch(source, /<table\s|<thead|<select|<details|history-mobile-table/)
  assert.ok(source.includes('#after-order-number="{ filters }"'))
  assert.ok(read('../mobile/equity/EquityFilters.vue').includes('<slot name="after-order-number" :filters="draft"'))
  assert.match(source, /readonly :custom-columns="tableColumns"/)
  const table = read('../mobile/equity/EquityRecordsTable.vue')
  assert.ok(table.includes("['action'") === false)
  assert.ok(table.includes('!props.readonly'))
  assert.ok(table.includes("if (props.readonly) return"))
  assert.ok(table.includes('<EquityOrderStatus'))
})
test('App 所有状态的转手工门禁与 PC 一致', () => {
  for (const status of orderStatuses) {
    assert.equal(canConvertOrder({ status, orderType: '系统单' }), status === '异常')
    assert.equal(canConvertOrder({ status, orderType: '手工单' }), false)
    assert.equal(canConvertOrder({ status, orderType: '系统单' }, false), false)
  }
})

test('首页与下单标题复用同一账户入口，单选/多选与锁定行为留在各自业务层', () => {
  const home = read('../mobile/equity/EquityTrading.vue')
  const entry = read('../mobile/equity/EquityOrderEntry.vue')
  for (const source of [home, entry]) {
    assert.match(source, /import EquityAccountTrigger from '\.\/EquityAccountTrigger\.vue'/)
    assert.match(source, /<EquityAccountTrigger/)
    assert.doesNotMatch(source, /<svg class="equity-account-icon"/)
  }
  assert.match(home, /<EquityAccountTrigger[^\n]*@click="openFilters\(true, \$event\)"/)
  assert.match(entry, /<EquityAccountTrigger[^\n]*:disabled="isLocked"/)
  assert.match(entry, /<EquityAccountTrigger[^\n]*@click="navigate\('accounts', \$event\)"/)
  assert.match(entry, /wasAccountPicker \? accountTrigger\.value/)
  const trigger = read('../mobile/equity/EquityAccountTrigger.vue')
  assert.match(trigger, /defineExpose\(\{ focus:/)
  assert.match(trigger, /equity-account-icon/)
  assert.match(trigger, /<b>\{\{ label \}\}<\/b>/)
})
