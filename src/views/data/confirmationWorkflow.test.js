import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { confirmationColumns, confirmationFilterFields, createConfirmationRecords, defaultConfirmationFilters, filterConfirmations } from './confirmationModel.js'
import { useConfirmationRecords } from './useConfirmationRecords.js'
import { prepareConfirmationDownload } from './confirmationDownload.js'
import { crc32 } from '../../utils/zipArchive.js'

const today = '2026-10-28', records = createConfirmationRecords()
test('邮件字段及筛选全部移除，编号/日期/交易对手组合查询有效', () => {
  assert.ok([...confirmationColumns, ...confirmationFilterFields].every(field => !/邮件|email/i.test(field.label + field.key)))
  const filters = defaultConfirmationFilters(today)
  filters.documentNo = 'CW0349'; filters.range = ['2026-10-26', '2026-10-26']; filters.counterparty = '0349'
  assert.equal(filterConfirmations(records, filters, today).length, 3)
  filters.confirmationNo = '66927'
  assert.deepEqual(filterConfirmations(records, filters, today).map(row => row.id), ['confirmation-66927'])
  filters.eventType = '部分平仓'
  assert.equal(filterConfirmations(records, filters, today).length, 0)
})

test('确认书日期默认近七天含当天，清空查询全部，单边或未来日期仍被拦截', () => {
  const filters = defaultConfirmationFilters(today)
  assert.deepEqual(filters.range, ['2026-10-22', today])
  assert.deepEqual(defaultConfirmationFilters('2026-01-03').range, ['2025-12-28', '2026-01-03'])
  assert.equal(filterConfirmations(records, filters, today).length, 3)
  filters.range = []
  assert.deepEqual(confirmationFilterFields.filter(field => field.primary).map(field => field.key), ['range', 'documentNo', 'counterparty', 'masterContractNo'])
  assert.equal(filterConfirmations(records, filters, today).length, 10)
  filters.range = ['2026-10-26']
  assert.equal(filterConfirmations(records, filters, today).length, 0)
  filters.range = ['2026-10-26', '2026-10-26']
  assert.equal(filterConfirmations(records, filters, today).length, 3)
  filters.range = []
  assert.equal(filterConfirmations([...records, { ...records[0], eventDate: '2026-10-29' }], filters, today).length, 10)
})

test('编辑筛选不立即更新，查询后只选择父节点，重新查询清理隐藏选择', () => {
  const scope = effectScope()
  scope.run(() => {
    const state = useConfirmationRecords({ now: () => new Date('2026-10-28T02:00:00Z') })
    assert.equal(state.groups.value.length, 1)
    assert.deepEqual(state.draft.value.range, ['2026-10-22', today])
    state.draft.value.range = []
    assert.equal(state.groups.value.length, 1)
    assert.equal(state.query(), true)
    assert.equal(state.groups.value.length, 3)
    state.toggleSelection('confirmation-66927')
    assert.deepEqual(state.selected.value, [])
    state.selectPage(true)
    assert.equal(state.selected.value.length, 3)
    state.draft.value.documentNo = 'cw0349'
    assert.equal(state.groups.value.length, 3)
    state.query()
    assert.equal(state.groups.value.length, 1)
    assert.deepEqual(state.selected.value, [])
    state.reset()
    assert.deepEqual(state.draft.value.range, ['2026-10-22', today])
    assert.equal(state.draft.value.documentNo, '')
    assert.equal(state.groups.value.length, 1)
    state.draft.value.range = ['2026-10-29', '2026-10-28']
    assert.equal(state.query(), false)
    assert.ok(state.error.value)
    assert.equal(state.groups.value.length, 1)
  })
  scope.stop()
})
const fetchFile = async path => ({ ok: true, arrayBuffer: async () => {
  const content = readFileSync(new URL('../../../public/' + path.replace(/^\/demo\//, ''), import.meta.url))
  return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
} })
test('ZIP 可由独立解压器读取，批量文件去重且 PDF 内容与原文件一致', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
  const archive = await prepareConfirmationDownload(['cw0349_test-20261026', 'cw0341_test-20261013', 'cw0349_test-20261026'], { baseUrl: '/demo/', fetchFile })
  assert.equal(archive.count, 2)
  assert.ok(archive.filename.endsWith('.zip'))
  const check = spawnSync('python3', ['-c', 'import sys,io,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert all(z.read(n).startswith(b"%PDF-") for n in z.namelist()); print(json.dumps(z.namelist(),ensure_ascii=False))'], { input: archive.bytes, encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  assert.deepEqual(JSON.parse(check.stdout), ['cw0349_test_20261026_Trade Confirmation.pdf', 'cw0341_test_20261013_Trade Confirmation_演示.pdf'])
})
test('下载失败或文件不是 PDF 时不产出不完整 ZIP', async () => {
  await assert.rejects(prepareConfirmationDownload([]), /勾选/)
  await assert.rejects(prepareConfirmationDownload(['missing']), /暂无/)
  await assert.rejects(prepareConfirmationDownload(['cw0349_test-20261026'], { fetchFile: async () => ({ ok: false }) }), /加载失败/)
  await assert.rejects(prepareConfirmationDownload(['cw0349_test-20261026'], { fetchFile: async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('<html>not found</html>').buffer }) }), /格式无效/)
})
