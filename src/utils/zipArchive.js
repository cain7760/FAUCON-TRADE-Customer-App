// ZIP STORE：PDF 已压缩，无需再引入压缩依赖；UTF-8 文件名由通用解压工具识别。
const encoder = new TextEncoder()
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
export function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
export function createZipArchive(files) {
  if (!files.length || files.length > 65535) throw new Error('下载文件数量无效')
  const localParts = [], centralParts = [], names = new Set()
  let offset = 0, centralSize = 0
  for (const file of files) {
    if (!file.name || /[/\\]/.test(file.name) || names.has(file.name)) throw new Error('下载文件名无效或重复')
    names.add(file.name)
    const name = encoder.encode(file.name), bytes = file.bytes, checksum = crc32(bytes)
    if (name.length > 65535 || bytes.length > 0xffffffff || offset + bytes.length > 0xffffffff) throw new Error('下载文件过大')
    const local = new Uint8Array(30 + name.length), header = new DataView(local.buffer)
    header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true)
    header.setUint16(6, 0x0800, true); header.setUint16(12, 0x21, true)
    header.setUint32(14, checksum, true); header.setUint32(18, bytes.length, true); header.setUint32(22, bytes.length, true)
    header.setUint16(26, name.length, true); local.set(name, 30)
    const central = new Uint8Array(46 + name.length), directory = new DataView(central.buffer)
    directory.setUint32(0, 0x02014b50, true); directory.setUint16(4, 20, true); directory.setUint16(6, 20, true)
    directory.setUint16(8, 0x0800, true); directory.setUint16(14, 0x21, true)
    directory.setUint32(16, checksum, true); directory.setUint32(20, bytes.length, true); directory.setUint32(24, bytes.length, true)
    directory.setUint16(28, name.length, true); directory.setUint32(42, offset, true); central.set(name, 46)
    localParts.push(local, bytes); centralParts.push(central)
    offset += local.length + bytes.length; centralSize += central.length
  }
  const end = new Uint8Array(22), footer = new DataView(end.buffer)
  footer.setUint32(0, 0x06054b50, true); footer.setUint16(8, files.length, true); footer.setUint16(10, files.length, true)
  footer.setUint32(12, centralSize, true); footer.setUint32(16, offset, true)
  const result = new Uint8Array(offset + centralSize + end.length)
  let cursor = 0
  for (const part of [...localParts, ...centralParts, end]) { result.set(part, cursor); cursor += part.length }
  return result
}
