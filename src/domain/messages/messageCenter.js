export const messageCategories = ['全部', '通知', '消息', '待办']
export const messageStorageKey = 'faucon-customer-app-messages-v1'

// 与 Customer PC 的通知/待办样例同源；日期写明，不将历史通知显示为“今天”。
const notices = [
  { id: 'notice-maintenance', category: '通知', title: '系统例行维护通知', content: '交易系统于 2026 年 9 月 14 日 02:00—04:00 进行例行维护。维护期间，订单查询、资金查询及部分行情服务可能出现短暂延迟，请关注系统通知并确认未完成订单的状态。', time: '2026-09-13 10:20:00', unread: true },
  { id: 'todo-suitability', category: '待办', title: '请完成适当性评估更新', content: '专业投资者适当性资料即将到期，请联系客户经理核对资料有效期并完成更新。', time: '2026-09-13 09:15:00', unread: true },
  { id: 'notice-transfer', category: '通知', title: '账户资金划转完成', content: '资金划转申请已处理完成，到账金额 100,000.00 CNY。', time: '2026-09-12 11:06:00', unread: false },
]

// 仅整理现有样例正文中的信息，不推断待办完成状态或维护是否正在进行。
const noticeBriefs = {
  'notice-maintenance': {
    highlight: { label: '维护时间', value: '2026-09-14', suffix: '02:00—04:00', numeric: true },
    fields: [{ label: '影响服务', value: '订单查询、资金查询及部分行情服务' }],
    note: '维护期间可能短暂延迟，请确认未完成订单状态。',
  },
  'notice-transfer': {
    highlight: { label: '到账金额', value: '100,000.00', suffix: 'CNY', numeric: true },
    note: '资金划转申请已处理完成。',
  },
  'todo-suitability': {
    highlight: { label: '办理方式', value: '联系客户经理' },
    note: '专业投资者适当性资料即将到期。',
    steps: ['核对资料有效期', '完成适当性资料更新'],
  },
}

export function messageBrief(row) {
  // 兼容本地已保存的旧消息；正文变化或新增消息时按原文展示，避免套用失效信息。
  const source = notices.find(notice => notice.id === row.id)
  return source && source.category === row.category && source.title === row.title && source.content === row.content
    ? noticeBriefs[row.id] : null
}

export const initialMessageState = () => ({ version: 1, messages: notices.map(row => ({ ...row })), revisions: {}, initialized: false, nextId: 1 })

export function loadMessages(storage) {
  try {
    const state = JSON.parse(storage?.getItem(messageStorageKey) || 'null')
    if (state?.version === 1 && Array.isArray(state.messages) && state.messages.every(row => row && typeof row.id === 'string'
      && messageCategories.slice(1).includes(row.category) && ['title', 'content', 'time'].every(key => typeof row[key] === 'string') && typeof row.unread === 'boolean')
      && state.revisions && typeof state.revisions === 'object' && !Array.isArray(state.revisions) && typeof state.initialized === 'boolean'
      && Object.values(state.revisions).every(value => typeof value === 'string') && Number.isSafeInteger(state.nextId) && state.nextId > 0) {
      return { ...state, messages: [...new Map(state.messages.map(row => [row.id, row])).values()] }
    }
  } catch { /* 存储不可用或损坏时仍可使用本次会话。 */ }
  return initialMessageState()
}
export function saveMessages(storage, state) {
  try { storage?.setItem(messageStorageKey, JSON.stringify(state)); return !!storage }
  catch { return false }
}

const revision = row => JSON.stringify([row.status, row.quantity, row.inputAmount, row.price, row.filledQuantity,
  row.filledPrice, row.orderType, row.feedback, row.traderRemark, row.history?.at(-1)])
const orderKey = row => JSON.stringify([row.account, String(row.id)])
function orderMessage(row, sequence, unread, isNew, receivedAt, action) {
  const history = row.history?.at(-1)
  const status = row.status || '--'
  const title = isNew ? '订单已提交' : action ? `订单${action}` : `订单状态更新 · ${status}`
  const content = [
    `${row.name}（${row.code}）${row.side === 'buy' ? '买入' : '卖出'}订单，当前状态：${status}。`,
    row.feedback, row.traderRemark && `交易员：${row.traderRemark}`,
  ].filter(Boolean).join(' ')
  return {
    id: `order:${orderKey(row)}:${sequence}`, category: '消息', title, content, unread,
    time: unread ? receivedAt : history?.time || row.orderTime || '',
    order: { id: String(row.id), orderNo: String(row.orderNo), account: row.account, name: row.name,
      code: row.code, market: row.market, status, quantity: row.quantity, price: row.price,
      filledQuantity: row.filledQuantity || 0, filledPrice: row.filledPrice, currency: row.currency || 'CNY' },
  }
}

// 首次只收录最近八笔快照且不制造未读；此后的新委托和回报逐条入箱，不改写旧消息。
export function syncOrderMessages(state, orders, receivedAt) {
  if (!orders.length) return false
  const firstSync = !state.initialized
  const recent = new Set([...orders].sort((a, b) => String(b.orderTime).localeCompare(String(a.orderTime))).slice(0, 8).map(orderKey))
  const additions = []
  for (const row of orders) {
    const key = orderKey(row), signature = revision(row), previous = state.revisions[key]
    if (previous === signature) continue
    state.revisions[key] = signature
    if (firstSync && !recent.has(key)) continue
    let previousHistory
    try { previousHistory = previous && JSON.parse(previous).at(-1) } catch { /* 兼容旧回报指纹。 */ }
    const changedAction = previous != null && JSON.stringify(previousHistory) !== JSON.stringify(row.history?.at(-1)) ? row.history?.at(-1)?.action : null
    additions.push(orderMessage(row, state.nextId++, !firstSync, !firstSync && previous == null, receivedAt, changedAction))
  }
  state.initialized = true
  state.messages = [...additions, ...state.messages].sort((a, b) => b.time.localeCompare(a.time))
  return firstSync || additions.length > 0
}
export const unreadCount = (messages, category = '全部') => messages.filter(row => row.unread && (category === '全部' || row.category === category)).length
export const filterMessages = (messages, category, onlyUnread = false) => messages.filter(row => (category === '全部' || row.category === category) && (!onlyUnread || row.unread))
export function markMessagesRead(state, id) {
  let count = 0
  for (const row of state.messages) if (row.unread && (id == null || row.id === id)) { row.unread = false; count++ }
  return count
}
