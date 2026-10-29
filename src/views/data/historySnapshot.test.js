import test from 'node:test'
import assert from 'node:assert/strict'
import { captureHistoryRecords } from './historySnapshot.js'
import { useHistoryRecords } from './useHistoryRecords.js'
import { expireOrdersAtClose } from '../../domain/orders/marketSession.js'
const order = () => ({ id: 'live', orderNo: 'LIVE-1', orderTime: '2026-10-27 09:30:00', market: 'SZ', account: 'TZS_T0', status: '部成', side: 'buy', openClose: '开', orderType: '系统单', type: 'limit', price: 10, quantity: 1000, filledQuantity: 400, filledPrice: 10, filledAmount: 4000, inputAmount: 10100, reportQuantity: 600, frozenMargin: 2400, history: [{ message: 'original' }] })
const fill = (tradeNo, quantity) => ({ ...order(), tradeNo, tradeDate: '20261027', filledTime: '2026-10-27 10:00:00', filledQuantity: quantity, filledAmount: quantity * 10 })
test('捕获未筛选全账户订单，旧编号去重，逐笔成交不丢失、不伪造', () => {
  const row = order(), trades = [fill('CJ1', 100), fill('CJ2', 300), fill('', 10), fill('CJ0', 0)]
  const result = captureHistoryRecords({ orders: [row], trades: [] }, { orders: [{ ...row, status: '部撤' }, { ...row, id: 'other', orderNo: 'LIVE-2', account: 'TZS_T1' }], trades }, [{ id: 'TZS_T0', name: '自营一号' }])
  assert.equal(result.orders.length, 2); assert.equal(result.orders[0].status, '部撤')
  assert.equal(result.orders[0].accountLabel, 'TZS_T0 - 自营一号')
  assert.equal(result.trades.length, 2); assert.equal(result.trades.reduce((sum, row) => sum + row.filledQuantity, 0), 400)
  assert.ok(result.trades.every(row => row.tradeDate === '2026-10-27' && row.status === '部撤'))
  assert.equal(result.trades[0].filledAmount, 1000)
  trades[0].history[0].message = 'changed'
  assert.equal(result.trades[0].history[0].message, 'original')
})
test('历史包含当天，收盘只改变所有订单；查询/刷新才更新当前历史表', () => {
  let now = new Date('2026-10-27T06:59:59Z'), reads = 0
  const live = order(), source = { orders: [live], trades: [fill('CJ1', 400)] }
  const history = useHistoryRecords({ now: () => now, readSource: () => { reads++; expireOrdersAtClose(source.orders, now); return source } })
  const currentRow = () => history.rows.value.find(row => row.orderNo === 'LIVE-1')
  assert.equal(history.maxDate.value, '2026-10-27')
  assert.equal(currentRow().status, '部成')
  now = new Date('2026-10-27T07:00:00Z')
  expireOrdersAtClose(source.orders, now)
  assert.equal(live.status, '部撤'); assert.equal(currentRow().status, '部成')
  history.sortBy('status', 'ascending'); history.state.value.pageSize = 50; history.state.value.page = 2
  history.accountIds.value = ['TZS_T0']; history.reset()
  assert.equal(reads, 1); assert.equal(currentRow().status, '部成')
  history.query()
  assert.equal(reads, 2); assert.equal(currentRow().status, '部撤')
  assert.equal(currentRow().reportQuantity, 0); assert.equal(currentRow().frozenMargin, 0)
  assert.equal(currentRow().canceledValue, 6100)
  history.kind.value = 'trades'
  assert.equal(currentRow().status, '部成')
  history.query()
  assert.equal(currentRow().status, '部撤'); assert.equal(currentRow().filledQuantity, 400)
  assert.equal(currentRow().filledAmount, 4000)
  const count = reads
  history.draft.value.range = ['2026-10-28', '2026-10-28']
  assert.equal(history.query(), false); assert.equal(reads, count)
})
