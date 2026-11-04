import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, ref } from 'vue'
import { useOrderSessionExpiry } from './useOrderSessionExpiry.js'
import { useTradingTime, nonTradingTimeMessage } from './useTradingTime.js'
import { deferLunchOperation, flushLunchOperations } from '../domain/orders/lunchBreak.js'

test('交易时间演示只在正式提交返回错误，可来回切换', () => {
  const scope = effectScope()
  const state = scope.run(() => useTradingTime())
  assert.equal(state.tradingTimeError(), '')
  state.setTradingTimeMode('non-trading')
  assert.equal(state.tradingTimeError(), nonTradingTimeMessage)
  state.setTradingTimeMode('trading')
  assert.equal(state.tradingTimeError(), '')
  state.setTradingTimeMode('invalid')
  assert.equal(state.tradingTimeMode.value, 'trading')
  scope.stop()
})
test('默认自动收盘，手动交易模式仅恢复本次自动撤单，保留人工终态并暂停计时', async () => {
  const scope = effectScope(), mode = ref(null)
  const rows = ref([
    { id: 'part', market: 'SZ', orderTime: '2000-01-04 10:00:00', status: '部成', quantity: 1000, filledQuantity: 400, reportQuantity: 600, canceledQuantity: 0, frozenMargin: 100, feedback: '部分成交' },
    { id: 'manual', market: 'SZ', orderTime: '2000-01-04 10:00:00', status: '撤单', quantity: 1000, filledQuantity: 0, canceledQuantity: 1000 },
  ])
  const sync = scope.run(() => useOrderSessionExpiry(rows, { demoMode: mode }))
  assert.equal(rows.value[0].status, '部撤')
  assert.equal(rows.value[0].canceledQuantity, 600)
  mode.value = 'trading'; await nextTick()
  assert.equal(rows.value[0].status, '部成')
  assert.equal(rows.value[0].canceledQuantity, 0)
  assert.equal(rows.value[0].frozenMargin, 100)
  assert.equal(rows.value[0].filledQuantity, 400)
  assert.equal(rows.value[1].status, '撤单')
  assert.deepEqual(sync(), [])
  mode.value = 'non-trading'
  assert.deepEqual(sync(), [])
  assert.equal(rows.value[0].status, '部成')
  scope.stop()
})

test('午休复市处理失败保留申请，数据监听不会立即递归重试', async () => {
  const scope = effectScope(), mode = ref('trading')
  const rows = ref([{ id: 'pending', market: 'SZ', status: '部成', quantity: 1000, filledQuantity: 400 }])
  deferLunchOperation(rows.value[0], 'amend', { quantity: 800 }, new Date('2026-11-04T12:00:00+08:00'))
  let attempts = 0
  const sync = scope.run(() => useOrderSessionExpiry(rows, { demoMode: mode, onTick: () => {
    flushLunchOperations(rows.value, () => { attempts += 1; throw new Error('余额不足') }, new Date('2026-11-04T13:00:00+08:00'), mode.value)
  } }))
  assert.equal(attempts, 1)
  assert.equal(rows.value[0].status, '待改')
  assert.ok(rows.value[0].pendingLunchOperation)
  sync(); await nextTick()
  assert.equal(attempts, 2)
  assert.equal(rows.value[0].quantity, 1000)
  assert.equal(rows.value[0].filledQuantity, 400)
  scope.stop()
})

