import { confirmationFiles } from './confirmationModel.js'
import { createZipArchive } from '../../utils/zipArchive.js'

export async function prepareConfirmationDownload(documentNos, { baseUrl = '/', fetchFile = fetch } = {}) {
  const ids = [...new Set(documentNos)]
  if (!ids.length) throw new Error('请先勾选确认书文档编号')
  const files = await Promise.all(ids.map(async id => {
    const file = confirmationFiles[id]
    if (!file) throw new Error(`${id} 暂无可下载文件`)
    const response = await fetchFile(baseUrl + file.path)
    if (!response.ok) throw new Error(`${id} 文件加载失败，请重试`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error(`${id} 文件格式无效`)
    return { name: file.name, bytes }
  }))
  return { bytes: createZipArchive(files), filename: ids.length === 1 ? `${ids[0]}.zip` : `交易确认书_${ids.length}份.zip`, count: ids.length }
}
export function saveConfirmationDownload(archive) {
  const href = URL.createObjectURL(new Blob([archive.bytes], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = href; link.download = archive.filename; link.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
