import test from 'node:test'
import assert from 'node:assert/strict'
import { useHistoryRecords } from './useHistoryRecords.js'

test('账户是独立查询草稿，多选只在查询或刷新后生效，重置恢复全部', () => {
  let reads = 0
  const orders = ['TZS_T0', 'TZS_T1'].map((account, i) => ({ id: 'account-test-' + i, orderNo: 'ACCOUNT-TEST-' + i, orderTime: '2026-10-27 10:00:00', code: '000001', market: 'SZ', name: '账户测试', account, status: '已报', side: 'buy', openClose: '开', orderType: '系统单', type: 'limit', price: 10, quantity: 100, filledQuantity: 0 }))
  const history = useHistoryRecords({ now: () => new Date('2026-10-27T04:00:00Z'), readSource: () => { reads++; return { orders, trades: [] } } })
  const live = () => history.rows.value.filter(row => row.orderNo?.startsWith('ACCOUNT-TEST-'))
  assert.deepEqual(history.accountIds.value, [])
  assert.equal(live().length, 2)
  history.accountIds.value = ['TZS_T0']
  assert.equal(live().length, 2, '选择账户不能立即改变表格')
  history.query()
  assert.deepEqual(live().map(row => row.account), ['TZS_T0'])
  history.accountIds.value.push('TZS_T1')
  assert.equal(live().length, 1, '草稿与已应用数组不能共用引用')
  history.query()
  assert.equal(live().length, 2)
  const beforeReset = reads
  history.reset()
  assert.deepEqual(history.accountIds.value, [])
  assert.deepEqual(history.state.value.applied.accounts, [])
  assert.equal(reads, beforeReset, '重置不额外同步源状态')

  history.accountIds.value = ['TZS_T0']; history.query()
  history.kind.value = 'trades'
  assert.deepEqual(history.accountIds.value, [], '两个历史表保持各自的查询条件')
  history.accountIds.value = ['TZS_T1']
  history.query()
  history.kind.value = 'orders'
  assert.deepEqual(history.state.value.applied.accounts, ['TZS_T0'])
  assert.deepEqual(live().map(row => row.account), ['TZS_T0'])
  history.accountIds.value = ['TZS_T1']
  history.draft.value.range = ['2026-10-28', '2026-10-28']
  assert.equal(history.query(), false)
  assert.deepEqual(history.state.value.applied.accounts, ['TZS_T0'], '日期校验失败不提交账户条件')
})
