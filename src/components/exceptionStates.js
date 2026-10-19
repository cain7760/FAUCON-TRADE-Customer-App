export const exceptionStates = Object.freeze({
  'not-found': { title: '页面不存在', description: '访问的页面不存在或已移动。', action: '返回交易首页' },
  network: { title: '网络异常', description: '网络连接已断开，请检查连接后重试。', action: '重试' },
  forbidden: { title: '无访问权限', description: '当前账户无权访问此内容，请联系管理员。' },
  maintenance: { title: '系统维护', description: '服务正在维护，请稍后再试。' },
  busy: { title: '服务繁忙', description: '服务暂时繁忙，请稍后重试。', action: '重试' },
  empty: { title: '暂无数据', description: '当前没有可显示的内容。' },
  timeout: { title: '请求超时', description: '请求未能及时完成，请重试。', action: '重试' },
  restricted: { title: '交易受限', description: '当前账户暂不能进行此项交易，请联系管理员。' },
})

const aliases = Object.freeze({ '404': 'not-found', '403': 'forbidden', '408': 'timeout', '429': 'busy', '503': 'busy', '504': 'timeout' })

export function normalizeException(value) {
  const key = String(value ?? '').trim().toLowerCase()
  const resolved = aliases[key] || key
  return Object.hasOwn(exceptionStates, resolved) ? resolved : null
}
