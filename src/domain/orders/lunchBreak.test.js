import test from 'node:test'
import assert from 'node:assert/strict'
import { isLunchBreak, deferLunchOperation, flushLunchOperations } from './lunchBreak.js'
const time = clock => new Date(`2026-11-04T${clock}+08:00`)
test('按市场识别午休，边界、周末及半日市不误判', () => {
  assert.equal(isLunchBreak({market:'SZ'}, time('11:30:00')), true)
  assert.equal(isLunchBreak({market:'SZ'}, time('12:59:59')), true)
  assert.equal(isLunchBreak({market:'SZ'}, time('13:00:00')), false)
  assert.equal(isLunchBreak({market:'HK'}, time('11:30:00')), false)
  assert.equal(isLunchBreak({market:'HK'}, time('12:00:00')), true)
  assert.equal(isLunchBreak({market:'US'}, time('12:00:00')), false)
  assert.equal(isLunchBreak({market:'SZ'}, new Date('2026-11-07T12:00:00+08:00')), false)
  assert.equal(isLunchBreak({market:'HK'}, new Date('2026-12-24T12:30:00+08:00')), false)
})
test('午休撤改只记录申请，复市或手动交易时间后才处理，且只处理一次', () => {
  for (const action of ['cancel','amend']) {
    const row = {id:'one',market:'SZ',status:'部成',quantity:1000,filledQuantity:400,reportQuantity:600,frozenMargin:100,canceledQuantity:0,price:12}
    assert.equal(deferLunchOperation(row, action, {quantity:800},time('12:00:00')),true)
    assert.equal(row.status, action==='amend'?'待改':'待撤')
    assert.equal(row.quantity,1000);assert.equal(row.filledQuantity,400);assert.equal(row.frozenMargin,100);assert.equal(row.canceledQuantity,0)
    let calls=0
    const apply=(item,pending)=>{calls++;assert.equal(item.status,'部成');assert.equal(pending.payload.quantity,800);item.status='已报'}
    flushLunchOperations([row],apply,time('12:59:59'));assert.equal(calls,0)
    flushLunchOperations([row],apply,time('13:00:00'),'non-trading');assert.equal(calls,0)
    flushLunchOperations([row],apply,time('13:00:00'));assert.equal(calls,1)
    flushLunchOperations([row],apply,time('13:01:00'));assert.equal(calls,1)
  }
  assert.equal(deferLunchOperation({market:'SZ'},'amend',{},time('12:00:00'),'trading'),false)
})
