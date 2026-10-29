import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEquityHistory, equityHistoryCsv, equityHistorySource } from './equityHistory.js'

const order = { side: 'buy', openClose: '开', type: 'limit', quantity: 900, orderTime: '2026-09-18 09:30:00', status: '部成', filledQuantity: 300, orderType: '系统单' }

test('历史演示回退保持 PC 下单和状态生成规则，并按时间倒序', () => {
  const original = structuredClone(order)
  assert.deepEqual(buildEquityHistory(order), [
    { operator: '交易所', time: '2026-09-18 09:30:45', type: '部成', content: '订单已部分成交，成交数量 300 股。' },
    { operator: '当前账户', time: '2026-09-18 09:30:00', type: '下单', content: '提交买入开仓限价订单：900 股。' },
  ])
  assert.deepEqual(order, original)
})

test('手工单受理、金额与转手工时间沿用 PC 演示口径', () => {
  const entries = buildEquityHistory({ ...order, side: 'sell', openClose: '平', orderType: '手工单', inputAmount: 10000, status: '拒单', traderRemark: '价格偏离', convertedToManualAt: '2026-09-18 10:00:00', orderRemark: '分批执行' })
  assert.equal(entries.length, 4)
  assert.equal(entries[0].content, '已转为手工单；下单备注：分批执行')
  assert.equal(entries[1].time, '2026-09-18 09:31:30')
  assert.equal(entries[1].content, '价格偏离')
  assert.equal(entries[2].type, '受理')
  assert.equal(entries[3].content, '提交卖出平仓限价订单：10,000.00 CNY。')
})

test('已有 PC 或 App 本地历史优先，不追加推导交易记录', () => {
  const records = buildEquityHistory({ ...order, history: [
    { label: '客户提交', at: '2026-09-18 09:00:00', detail: '客户已提交订单' },
    { label: '审批通过', at: '2026-09-18 09:05:00', detail: '确认参数' },
    { action: '撤单', time: '2026-09-18 10:00:00', message: '本地撤单操作完成' },
  ] })
  assert.equal(records.length, 3)
  assert.equal(records[0].type, '撤单')
  assert.equal(records[0].content, '本地撤单操作完成')
  assert.equal(records[1].operator, '审批人')
  assert.equal(records[2].operator, '客户')
})

test('持仓与成交使用原记录，无记录时为空，非法时间不生成无效日期', () => {
  assert.deepEqual(buildEquityHistory(null), [])
  const position = { positionDate: '2026-09-18', qty: 100 }
  assert.equal(buildEquityHistory(position, 'positions')[1].content, '提交买入开仓限价订单：100 股。')
  assert.equal(equityHistorySource(position), 'demo')
  assert.equal(buildEquityHistory({ ...order, status: '全成', filledQuantity: 900 })[0].content, '订单已全部成交，成交数量 900 股。')
  assert.ok(buildEquityHistory({ ...order, orderTime: '未知时间' }).every(item => item.time === '未知时间'))
})

test('已有历史缺少时间时不以当前快照日期伪造发生时间', () => {
  const record = { ...order, history: [{ action: '撤单', message: '撤单完成' }] }
  assert.equal(buildEquityHistory(record)[0].time, '--')
  assert.equal(equityHistorySource(record), 'provided')
  assert.equal(equityHistorySource(null), 'empty')
})

test('CSV 包含全部四列，处理换行引号及公式前缀，不修改记录', () => {
  const record = { operator: '客户', time: '2026-09-18', type: '备注', content: '=1+1\n"注释"' }
  const csv = equityHistoryCsv([record])
  assert.ok(csv.startsWith('\ufeff"操作人","操作时间","操作类型","操作内容"\n'))
  assert.ok(csv.includes('"\'=1+1\n""注释"""'))
  assert.equal(record.content, '=1+1\n"注释"')
})
