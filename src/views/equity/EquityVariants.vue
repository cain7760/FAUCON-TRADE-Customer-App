<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDownBold, Bell, CaretBottom, ChatDotRound, Search, Document, Setting, InfoFilled, View, Hide, Clock, CircleCheck, CircleClose, Close, EditPen, List, More } from '@element-plus/icons-vue'
import ClientLineIcon from '../../ClientLineIcon.vue'
import SettingsMenuIcon from '../../SettingsMenuIcon.vue'
import { accounts } from './fixtures'
import { marketInstruments, variantRows, variants, money, number } from './variantData'
import { useTicketDock } from './useTicketDock'
import OrderTicket from './components/OrderTicket.vue'
import OrderBook from './components/OrderBook.vue'
import ClosePositionDialog from './components/ClosePositionDialog.vue'
import ChaseOrderDialog from './components/ChaseOrderDialog.vue'
import SortHeader from './components/SortHeader.vue'
import ColumnConfigPopover from './components/ColumnConfigPopover.vue'
import TradingTable from './components/TradingTable.vue'

const initialVariant = new URLSearchParams(location.search).get('layout')
const assetUrl = name => `${import.meta.env.BASE_URL}original-icons/${name}`
const variant = ref(variants.some(v => v.id === initialVariant) ? initialVariant : 'classic')
const activeNav = ref('权益交易')
const viewportWidth = ref(window.innerWidth)
const messageCenterVisible = ref(false)
const messageCategory = ref('全部')
const expandedMessageIds = ref([])
const headerNoticeKey = 'faucon-header-notice-dismissed-v2'
const showHeaderNotice = ref(true)
const systemNoticeEnabled = ref(true)
const showUnreadBadge = ref(true)
const settingsVisible = ref(false)
const activeSetting = ref('account')
const language = ref('简体中文')
const orderPrice = ref('最新价')
const colorRule = ref('red-up')
const theme = ref('dark')
const autoLaunch = ref(false)
const emergencyMessage = ref(null)
const systemRunning = ref(true)
const transactionToasts = ref([])
const transactionToastTimers = new Map()
const headerNotice = computed(() => systemRunning.value ? null : {
  id: 'system-interrupted', text: '交易系统当前中断，下单服务暂不可用；已提交委托请以委托状态为准。',
})
const messages = ref([
  { id: 1, category: '通知', title: '系统例行维护通知', content: '交易系统将于 9 月 14 日 02:00—04:00 进行例行维护。维护期间，委托查询、资金查询及部分行情服务可能出现短暂延迟，请提前安排交易并关注后续系统通知。若您有未完成的委托，请在维护窗口开始前确认其状态；维护结束后系统会自动恢复服务，无需重复提交。', time: '今天 10:20', unread: true },
  { id: 2, category: '待办', title: '请完成适当性评估更新', content: '您的专业投资者适当性资料将在 30 天后到期，请在到期前完成更新，以免影响相关交易权限的正常使用。', time: '今天 09:15', unread: true },
  { id: 3, category: '消息', title: '委托已全部成交', content: '平安银行（000001）买入委托已全部成交，成交均价 11.78 CNY。', time: '昨天 14:38', unread: true, trade: { name: '平安银行', code: '000001', status: '全部成交', quantity: 900, quantityLabel: '成交数量', price: 11.78, occurredAt: '2026-09-13 14:38:26' } },
  { id: 4, category: '通知', title: '账户资金划转完成', content: '资金划转申请已处理完成，到账金额 100,000.00 CNY。', time: '昨天 11:06', unread: false },
  { id: 5, category: '待办', title: '风险测评即将到期', content: '您的风险承受能力测评将在 2026 年 10 月 8 日到期。', time: '09-09 16:30', unread: false },
  { id: 6, category: '消息', title: '撤单申请已受理', content: '招商银行（600036）撤单申请已提交，当前状态：待撤。', time: '09-08 13:46', unread: false },
])
const messageCategories = ['全部', '通知', '消息', '待办']
const settingMenu = [
  { key: 'account', label: '账号信息' }, { key: 'language', label: '语言设置' },
  { key: 'trading', label: '交易与行情设置' }, { key: 'appearance', label: '系统外观' },
]
const filteredMessages = computed(() => messageCategory.value === '全部' ? messages.value : messages.value.filter(item => item.category === messageCategory.value))
const unreadMessageCount = computed(() => messages.value.filter(item => item.unread).length)
const pricePreviewClass = computed(() => colorRule.value === 'green-up' ? 'reverse' : '')
function categoryUnreadCount(category) { return messages.value.filter(item => item.unread && (category === '全部' || item.category === category)).length }
function messageIcon(category) { return assetUrl({ '全部': 'message-all.svg', '通知': 'message-notice.svg', '消息': 'message-system.svg', '待办': 'message-todo.svg' }[category]) }
function needsExpansion(message) { return message.content.length > 100 }
function messageIsExpanded(message) { return expandedMessageIds.value.includes(message.id) }
// 直接复用 Axure 导出的原始 SVG 图层；一个菜单图标由一个或两个图层组成。
const mainNav = [
  { label: '权益交易', icon: [['u76.svg', 0, 0, 14, 9], ['u77.svg', 0, 4, 14, 10]] },
  { label: '期权交易', icon: [['u83.svg', 0, 0, 13, 14], ['u84.svg', 7, 8, 6, 6]] },
  { label: '融资申请', icon: [['u90.svg', 2, 0, 10, 8], ['u91.svg', 0, 9, 14, 5]] },
  { label: '策略交易', icon: [['u100.svg', 0, 0, 12, 12], ['u101.svg', 3, 11, 7, 5]] },
  { label: '模拟交易', icon: [['u107.svg', 0, 0, 6, 7], ['u108.svg', 5, 0, 11, 15]] },
  { label: '数据', icon: [['u114.svg', 0, 0, 12, 13], ['u115.svg', 7, 6, 8, 8]] },
]
const overflowNav = computed(() => viewportWidth.value <= 980 ? mainNav.slice(3) : viewportWidth.value <= 1200 ? mainNav.slice(4) : [])
const visibleNav = computed(() => mainNav.slice(0, mainNav.length - overflowNav.value.length))
const workspace = ref(null), accountId = ref('TZS_T0'), showAll = ref(false), query = ref(''), market = ref('ALL'), positionType = ref('ALL')
const assetsVisible = ref(true), assetsCollapsed = ref(false)
const tab = ref('positions'), selectedCode = ref('000001'), table = ref(null), quote = ref(null)
const closePositionVisible = ref(false), closingPosition = ref(null)
const chaseOrderVisible = ref(false), chasingPosition = ref(null)
const orderStatusMachine = ['已撤', '暂停', '交易', '完成', '部成', '已报', '待报', '改单中', '异常', '其他']
const orderStatusOptions = orderStatusMachine.map(status => ({ label: status, value: status }))
const demoOrderStatuses = [...orderStatusMachine, '交易', '已报', '待报', '完成', '异常']
const demoOrders = ref(demoOrderStatuses.map((status, index) => {
  const instrument = variantRows[index % variantRows.length]
  const quantity = (index + 1) * 100
  const filledQuantity = status === '完成' ? quantity : ['部成', '交易'].includes(status) ? Math.max(100, Math.floor(quantity / 2 / 100) * 100) : 0
  const price = index % 3 === 1 ? null : instrument.price
  const estimate = (price || instrument.price) * quantity
  return {
    id: `seed-${index + 1}`, orderNo: `WT20260911${String(index + 1).padStart(3, '0')}`,
    account: 'TZS_T0', code: instrument.code, name: instrument.name, executionType: index % 4 === 3 ? 'highTouch' : 'lowTouch', type: price === null ? 'market' : 'limit',
    side: index % 2 ? 'sell' : 'buy', openClose: index % 3 ? '平' : '开', status,
    attribute: `${price === null ? '市价' : '限价'}·数量`, quantity, price,
    orderValueNumber: quantity, orderValue: `${number(quantity)} 股`, filledQuantity,
    filledPrice: filledQuantity ? instrument.price : null, estimate,
    canceledQuantity: status === '已撤' ? quantity - filledQuantity : 0,
    frozenMargin: ['已撤', '完成', '异常'].includes(status) ? 0 : estimate * .4,
    marginRate: 40, feedback: status === '异常' ? '风控校验未通过' : '',
    market: instrument.market, orderTime: `2026-09-11 09:${String(30 + index).padStart(2, '0')}:00`,
  }
}))
const orderFilters = ref({ orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', status: [] })
const appliedPositionFilters = ref({ query: '', market: 'ALL', positionType: 'ALL' })
const appliedOrderFilters = ref({ orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', status: [] })
const sortState = ref({ prop: null, direction: null })
const orderSortState = ref({ prop: null, direction: null })
const positionColumnDefaults = [
  'direction', 'executionType', 'code', 'name', 'price', 'opening', 'available', 'valueWan', 'marginOccupied',
  'marginRate', 'totalProfit', 'dailyRealizedProfit', 'floatingProfit', 'account', 'market',
]
const visibleColumnKeys = ref([...positionColumnDefaults])
const columnOptions = [
  ['direction', '多空'], ['executionType', '订单类型'], ['code', '标的代码'], ['name', '标的名称'], ['price', '持仓均价/最新价'],
  ['opening', '期初数量'], ['available', '可用数量'], ['valueWan', '市值(万)'], ['marginOccupied', '保证金占用'],
  ['marginRate', '保证金率(%)'], ['totalProfit', '总盈亏'], ['dailyRealizedProfit', '日内实现盈亏'],
  ['floatingProfit', '浮动盈亏'], ['account', '账户'], ['market', '市场'],
]
const orderColumnDefaults = ['code', 'name', 'status', 'openClose', 'side', 'attribute', 'price', 'orderValueNumber', 'filledQuantity', 'filledPrice', 'filledAmount', 'canceledValue', 'account', 'frozenMargin', 'executionType', 'marginRate', 'feedback', 'orderNo', 'orderTime', 'market']
const orderVisibleColumnKeys = ref([...orderColumnDefaults])
const orderColumnOptions = [
  ['code', '标的代码'], ['name', '标的名称'], ['status', '状态'], ['openClose', '开平'], ['side', '买卖'], ['attribute', '委托方式'],
  ['price', '委托价格'], ['orderValueNumber', '委托数量'], ['filledQuantity', '成交数量'], ['filledPrice', '成交均价'], ['filledAmount', '成交金额'],
  ['canceledValue', '撤单数量/金额'], ['account', '下单账户'], ['frozenMargin', '冻结保证金'], ['executionType', '订单类型'], ['marginRate', '保证金率'],
  ['feedback', '反馈信息'], ['orderNo', '订单编号'], ['orderTime', '下单时间'], ['market', '市场'],
]
const { dock, collapsed, dragging, resizing, floating, start, startResize } = useTicketDock(workspace)
dock.value = variants.find(v => v.id === variant.value).dock
const account = computed(() => accounts.find(a => a.id === accountId.value))
const instruments = computed(() => variantRows.map(p => accountId.value === 'TZS_T0' ? p : { ...p, id: p.id.replace('T0','T1'), qty: p.qty*2, available: p.available*2, value: p.value*2, account:'TZS_T1' }))
const emptySelected = { code: '', market: '', name: '请选择下单标的', price: null, cost: null, change: 0, available: 0 }
const selected = computed(() => instruments.value.find(p => p.code === selectedCode.value) || marketInstruments.find(p => p.code === selectedCode.value) || emptySelected)
const allRows = computed(() => showAll.value ? [...variantRows, ...variantRows.map(p => ({...p,id:p.id.replace('T0','T1'),qty:p.qty*2,available:p.available*2,value:p.value*2,account:'TZS_T1'}))] : instruments.value)
const filtered = computed(() => allRows.value.filter(p => (!appliedPositionFilters.value.query || `${p.code}${p.name}`.includes(appliedPositionFilters.value.query.trim())) && (appliedPositionFilters.value.market === 'ALL' || p.market === appliedPositionFilters.value.market) && (appliedPositionFilters.value.positionType === 'ALL' || p.direction === appliedPositionFilters.value.positionType)))
const sortedRows = computed(() => {
  const { prop, direction } = sortState.value
  if (!prop || !direction) return filtered.value
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const left = a[prop], right = b[prop]
    if (typeof left === 'string') return left.localeCompare(right, 'zh-CN') * multiplier
    return (left - right) * multiplier
  })
})
const orders = computed(() => demoOrders.value.filter(o => (showAll.value || o.account === accountId.value) && (!appliedOrderFilters.value.orderNo || o.orderNo.includes(appliedOrderFilters.value.orderNo.trim())) && (!appliedOrderFilters.value.symbol || `${o.code}${o.name}`.includes(appliedOrderFilters.value.symbol.trim())) && (appliedOrderFilters.value.side === 'ALL' || o.side === appliedOrderFilters.value.side) && (appliedOrderFilters.value.openClose === 'ALL' || o.openClose === appliedOrderFilters.value.openClose) && (!appliedOrderFilters.value.status.length || appliedOrderFilters.value.status.includes(o.status))))
const sortedOrders = computed(() => {
  const { prop, direction } = orderSortState.value
  if (!prop || !direction) return orders.value
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...orders.value].sort((a, b) => ((Number(a[prop]) || 0) - (Number(b[prop]) || 0)) * multiplier)
})
const floatStyle = computed(() => dock.value === 'floating' ? { left: `${floating.value.x}px`, top: `${floating.value.y}px`, width:`${floating.value.width}px`, height:`${floating.value.height}px` } : {})
function chooseVariant(id) { variant.value = id; dock.value = variants.find(v => v.id === id).dock; collapsed.value = false; history.replaceState(null,'',`${location.pathname}?layout=${id}`) }
function openMessageCenter() { messageCenterVisible.value = true }
function markMessageRead(message) { message.unread = false }
function markAllMessagesRead() { messages.value.forEach(message => { message.unread = false }) }
function toggleMessageExpansion(message) {
  expandedMessageIds.value = messageIsExpanded(message)
    ? expandedMessageIds.value.filter(id => id !== message.id)
    : [...expandedMessageIds.value, message.id]
}
function dismissHeaderNotice() {
  showHeaderNotice.value = false
  localStorage.setItem(headerNoticeKey, '1')
}
function toggleSystemStatus() {
  systemRunning.value = !systemRunning.value
  if (!systemRunning.value) { showHeaderNotice.value = true; selectedCode.value = null; quote.value = null }
}
function scrollToSetting(key) {
  activeSetting.value = key
  document.getElementById(`equity-${key}-setting`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function saveSettings() { settingsVisible.value = false }
function showEmergency(message) {
  if (message?.urgent) emergencyMessage.value = message
}
function showTransactionToast(message) {
  if (!message?.trade || transactionToastTimers.has(message.id)) return
  transactionToasts.value = [...transactionToasts.value, { message, remaining: 8 }]
  const countdownTimer = window.setInterval(() => {
    transactionToasts.value = transactionToasts.value.map(toast => toast.message.id === message.id
      ? { ...toast, remaining: Math.max(0, toast.remaining - 1) }
      : toast)
  }, 1000)
  const dismissTimer = window.setTimeout(() => dismissTransactionToast(message.id), 8000)
  transactionToastTimers.set(message.id, { countdownTimer, dismissTimer })
}
function dismissTransactionToast(id) {
  const timers = transactionToastTimers.get(id)
  if (timers) { window.clearInterval(timers.countdownTimer); window.clearTimeout(timers.dismissTimer) }
  transactionToastTimers.delete(id)
  transactionToasts.value = transactionToasts.value.filter(toast => toast.message.id !== id)
}
function timestampNow() {
  const date = new Date(), pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function enrichOrder(order) {
  const instrument = marketInstruments.find(item => item.code === order.code)
  return {
    ...order,
    status: order.status || '待报', market: order.market || instrument?.market || 'SZ', orderTime: order.orderTime || timestampNow(),
    marginRate: order.marginRate ?? 40, frozenMargin: order.frozenMargin ?? (order.estimate || 0) * .4,
    canceledQuantity: order.canceledQuantity || 0, canceledAmount: order.canceledAmount || 0, feedback: order.feedback || '',
  }
}
function accountLabel(id) { const item = accounts.find(value => value.id === id); return item ? `${item.id}·${item.name}` : id || '--' }
function marketLabel(marketValue) { return marketValue === 'HK' ? '港股' : 'A股' }
function filledAmount(row) { return row.filledQuantity && row.filledPrice !== null ? money(row.filledQuantity * row.filledPrice) : '--' }
function canceledOrderValue(row) { return row.canceledAmount ? `${money(row.canceledAmount)} CNY` : row.canceledQuantity ? `${number(row.canceledQuantity)} 股` : '--' }
function tradeStatusLabel(status) {
  if (status.includes('全部成交')) return '全部成交'
  if (status.includes('部分成交') || status.includes('部成')) return '部分成交'
  if (status.includes('撤单')) return '撤单'
  if (status.includes('改单')) return '改单'
  if (status.includes('已报')) return '已报'
  return status.replace(/^(买入|卖出)委托/, '').replace(/^委托已/, '')
}
function tradeStatusVisual(status) {
  const label = tradeStatusLabel(status)
  if (label === '全部成交') return { tone: 'success', icon: CircleCheck }
  if (label === '部分成交') return { tone: 'partial', icon: More }
  if (label === '撤单') return { tone: 'rejected', icon: CircleClose }
  if (label === '已报') return { tone: 'reported', icon: CircleCheck }
  return { tone: 'review', icon: EditPen }
}
function publishTransactionMessage({ name, code, status, quantity = null, quantityLabel = '成交数量', price = null, title = '委托状态更新' }) {
  const message = {
    id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: '消息', title,
    content: `${name}（${code}）${status}${price === null ? '。' : `，成交均价 ${money(price)} CNY。`}`,
    time: '刚刚', unread: true,
    trade: { name, code, status, quantity, quantityLabel, price, occurredAt: timestampNow() },
  }
  messages.value.unshift(message)
  showTransactionToast(message)
}
function triggerDemoTransactionToast() {
  publishTransactionMessage({ name: '平安银行', code: '000001', status: '买入委托全部成交', quantity: 900, price: 11.78, title: '委托已全部成交' })
}
function toggleAssetsVisible() { assetsVisible.value = !assetsVisible.value; if (assetsCollapsed.value) assetsCollapsed.value = false }
function applyFilters() { appliedPositionFilters.value = { query: query.value, market: market.value, positionType: positionType.value }; table.value?.setScrollTop?.(0) }
function applyOrderFilters() { appliedOrderFilters.value = { ...orderFilters.value, status: [...orderFilters.value.status] }; orderSortState.value = { prop: null, direction: null } }
function clearOrderFilters() { orderFilters.value = { orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', status: [] }; applyOrderFilters() }
function clearFilters() { query.value = ''; market.value = 'ALL'; positionType.value = 'ALL'; sortState.value = { prop: null, direction: null }; table.value?.clearFilter(); applyFilters() }
function exportPositions() {
  const header = ['多空', '订单类型', '标的代码', '标的名称', '持仓均价', '最新价', '可用数量', '市值(万)', '总盈亏', '账户', '市场']
  const records = sortedRows.value.map(row => [row.direction, row.executionType === 'highTouch' ? '手工单' : '系统单', `${row.code}.${row.market}`, row.name, money(row.cost), money(row.price), number(row.available), money(row.valueWan), money(row.totalProfit), row.account, row.market])
  const csv = [header, ...records].map(record => record.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = '持仓列表.csv'; link.click(); URL.revokeObjectURL(link.href)
}
function exportOrders() {
  const header = ['标的代码', '标的名称', '状态', '开平', '买卖', '委托方式', '委托价格', '委托数量', '成交数量', '成交均价', '成交金额', '撤单数量/金额', '下单账户', '冻结保证金', '订单类型', '保证金率', '反馈信息', '订单编号', '下单时间', '市场']
  const records = orders.value.map(row => [
    row.code, row.name, row.status, row.openClose === '开' ? '开仓' : '平仓', row.side === 'buy' ? '买入' : '卖出', row.type === 'market' ? '市价单' : '限价单',
    row.price === null ? '--' : money(row.price), number(row.quantity), number(row.filledQuantity || 0), row.filledPrice === null ? '--' : money(row.filledPrice), filledAmount(row), canceledOrderValue(row),
    accountLabel(row.account), money(row.frozenMargin || 0), row.executionType === 'highTouch' ? '手工单' : '系统单', `${row.marginRate || 0}%`, row.feedback || '--', row.orderNo, row.orderTime, marketLabel(row.market),
  ])
  const csv = [header, ...records].map(record => record.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = '委托记录.csv'; link.click(); URL.revokeObjectURL(link.href)
}
function chooseDock(value) { dock.value = value; if(value === 'floating' && workspace.value) floating.value = {x:Math.max(0, workspace.value.clientWidth-350),y:12,width:340,height:Math.min(650,workspace.value.clientHeight-12)} }
function toggleSort(prop) { const current = sortState.value; sortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleOrderSort(prop) { const current = orderSortState.value; orderSortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleOrderStatus(status) { const selected = orderFilters.value.status; orderFilters.value.status = selected.includes(status) ? selected.filter(value => value !== status) : [...selected, status] }
function selectAllOrderStatuses() { orderFilters.value.status = [...orderStatusMachine] }
function invertOrderStatuses() { const selected = new Set(orderFilters.value.status); orderFilters.value.status = orderStatusMachine.filter(status => !selected.has(status)) }
function orderStatusVisual(status) {
  if (['已撤', '其他'].includes(status)) return { tone: 'draft', icon: Document }
  if (['待报', '暂停'].includes(status)) return { tone: 'pending', icon: Clock }
  if (['交易', '已报'].includes(status)) return { tone: 'reported', icon: CircleCheck }
  if (status === '部成') return { tone: 'partial', icon: More }
  if (status === '完成') return { tone: 'success', icon: CircleCheck }
  if (status === '异常') return { tone: 'rejected', icon: CircleClose }
  return { tone: 'review', icon: EditPen }
}
watch(accountId, () => { quote.value = null })
watch(collapsed, async () => { await nextTick(); table.value?.doLayout?.() })
const accountBalance = computed(() => account.value.id === 'TZS_T0' ? 1000000 : 700000)
function assetAmountParts(value) {
  const amount = Number(value) || 0
  const yi = Math.floor(amount / 100000000)
  const afterYi = amount - yi * 100000000
  const wan = Math.floor(afterYi / 10000)
  const rest = (afterYi - wan * 10000).toFixed(2)
  return [
    ...(yi ? [{ value: number(yi), unit: '亿' }] : []),
    ...(wan || yi ? [{ value: number(wan), unit: '万' }] : []),
    { value: rest, unit: '' },
  ]
}
function acceptOrder(order) {
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '委托已提交', quantity: order.quantity, quantityLabel: '委托数量', title: '委托提交成功' })
}
function openClosePosition(row) { closingPosition.value = row; closePositionVisible.value = true }
function openChaseOrder(row) { chasingPosition.value = row; chaseOrderVisible.value = true }
function acceptClosePosition(order) {
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '卖出平仓委托已提交', quantity: order.quantity, quantityLabel: '委托数量', title: '平仓委托提交成功' })
}
function acceptChaseOrder(order) {
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '追单买入委托已提交', quantity: order.quantity, quantityLabel: '追单数量', title: '追单提交成功' })
}
function orderAction(row, action) {
  if (action === '追单') { row.status = '已报'; publishTransactionMessage({ name: row.name, code: row.code, status: '委托已报', quantity: row.quantity, quantityLabel: '委托数量', title: '追单已提交' }) }
  if (action === '改单') { row.status = '改单中'; publishTransactionMessage({ name: row.name, code: row.code, status: '改单申请已提交', quantity: row.quantity, quantityLabel: '委托数量', title: '委托修改申请' }) }
  if (action === '撤单') { row.status = '已撤'; row.canceledQuantity = Math.max(0, row.quantity - (row.filledQuantity || 0)); row.frozenMargin = 0; publishTransactionMessage({ name: row.name, code: row.code, status: '撤单成功', quantity: row.filledQuantity || null, title: '委托撤单成功' }) }
}
function updateViewportWidth() { viewportWidth.value = window.innerWidth }
onMounted(() => {
  showHeaderNotice.value = localStorage.getItem(headerNoticeKey) !== '1'
  window.addEventListener('resize', updateViewportWidth)
  showEmergency(messages.value.find(item => item.urgent))
  window.setTimeout(() => showTransactionToast(messages.value.find(item => item.trade)), 350)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
  transactionToastTimers.forEach(({ countdownTimer, dismissTimer }) => { window.clearInterval(countdownTimer); window.clearTimeout(dismissTimer) })
  transactionToastTimers.clear()
})
</script>

<template>
  <main class="variants-app" :class="`version-${variant}`">
    <header class="variant-header">
      <img :src="assetUrl('logo-faucon-trade.png')" alt="FAUCON TRADE"><i class="header-brand-divider" aria-hidden="true"></i>
      <nav aria-label="产品菜单">
        <button v-for="item in visibleNav" :key="item.label" :class="{ active: activeNav === item.label }" @click="activeNav = item.label"><span class="nav-menu-content"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span><span class="nav-menu-label">{{ item.label }}</span></span></button>
        <el-dropdown v-if="overflowNav.length" trigger="click" popper-class="variant-nav-popper" @command="label => activeNav = label"><button class="more-nav" :class="{ active: overflowNav.some(item => item.label === activeNav) }">更多<el-icon><CaretBottom /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="item in overflowNav" :key="item.label" :command="item.label"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span>{{ item.label }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </nav>
      <section v-if="showHeaderNotice && systemNoticeEnabled && !systemRunning" class="header-marquee" aria-label="系统通知" role="button" tabindex="0" @click="openMessageCenter" @keydown.enter="openMessageCenter"><el-icon><InfoFilled /></el-icon><b>系统通知</b><span class="notice-scroll"><i>{{ headerNotice.text }}　{{ headerNotice.text }}</i></span><button type="button" aria-label="关闭系统通知" @click.stop="dismissHeaderNotice"><el-icon><Close /></el-icon></button></section>
      <div class="variant-header-end"><button class="notification-action" aria-label="打开消息中心" @click="openMessageCenter"><ClientLineIcon type="notification" /><em v-if="showUnreadBadge && unreadMessageCount">{{ unreadMessageCount }}</em></button><button class="header-settings-action" aria-label="系统设置" @click="settingsVisible=true"><el-icon><Setting /></el-icon></button><button type="button" class="small-avatar avatar-toast-trigger" aria-label="触发交易消息提示" @click="triggerDemoTransactionToast">K</button><span>Kevin Zhang</span></div>
    </header>
    <aside class="transaction-toast-stack" aria-live="polite" aria-label="委托结果提示">
      <transition-group name="transaction-toast">
        <article v-for="toast in transactionToasts" :key="toast.message.id" class="transaction-toast-card">
          <header><span class="transaction-toast-type"><img :src="messageIcon('消息')" alt="">权益交易 · 委托回报</span><span class="transaction-toast-countdown">{{ toast.remaining }}s 后自动关闭</span><button type="button" :aria-label="`关闭${toast.message.title}`" @click="dismissTransactionToast(toast.message.id)"><el-icon><Close /></el-icon></button></header>
          <p class="transaction-toast-instrument"><span>{{ toast.message.trade.name }}</span><small>（{{ toast.message.trade.code }}）</small><em :class="`is-${tradeStatusVisual(toast.message.trade.status).tone}`"><el-icon><component :is="tradeStatusVisual(toast.message.trade.status).icon" /></el-icon>{{ tradeStatusLabel(toast.message.trade.status) }}</em></p>
          <dl class="transaction-toast-metrics"><div><dt>成交数量</dt><dd>{{ toast.message.trade.quantity ? `${number(toast.message.trade.quantity)} 股` : '--' }}</dd></div><div><dt>成交均价</dt><dd>{{ toast.message.trade.price !== null ? `${money(toast.message.trade.price)} CNY` : '--' }}</dd></div></dl>
        </article>
      </transition-group>
    </aside>
    <div ref="workspace" class="variants-workspace" :class="[`dock-${dock}`,{'ticket-collapsed':collapsed,'is-dragging':dragging}]">
      <section class="positions-pane workspace-panel">
        <header class="positions-tabs"><button :class="{active:tab==='positions'}" @click="tab='positions'">所有持仓<span>({{ allRows.length }})</span></button><button :class="{active:tab==='orders'}" @click="tab='orders'">所有委托<span>({{ orders.length }})</span></button><button :class="{active:tab==='trades'}" @click="tab='trades'">所有成交<span>(0)</span></button><el-switch v-model="showAll" active-text="展示全部账户" size="small" /><button v-if="collapsed" class="workspace-restore-ticket" @click="collapsed=false"><img class="restore-panel-icon" :src="assetUrl('panel-expand.svg')" alt=""><span class="restore-panel-label" style="color:#9ba3af!important;font-size:12px!important">展开下单面板</span></button></header>
        <template v-if="tab==='positions'">
          <div class="position-filters"><el-input v-model="query" :prefix-icon="Search" placeholder="代码 / 名称" aria-label="搜索持仓" clearable /><el-select v-model="market" aria-label="持仓市场" popper-class="variant-popper"><el-option label="全部市场" value="ALL"/><el-option label="深市" value="SZ"/><el-option label="沪市" value="SH"/></el-select><el-select v-model="positionType" aria-label="多空类型筛选" popper-class="variant-popper"><el-option label="全部多空类型" value="ALL"/><el-option label="多头" value="多"/><el-option label="空头" value="空"/></el-select><el-button class="filter-query" @click="applyFilters">查询</el-button><el-button link @click="clearFilters">重置</el-button><el-tooltip content="导出当前持仓" placement="top"><button class="export-positions" aria-label="导出持仓" @click="exportPositions"><el-icon><svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg></el-icon></button></el-tooltip></div>
          <TradingTable ref="table" class="original-fields" :data="sortedRows" height="100%" row-key="id" empty-text="无匹配持仓，请调整或重置筛选">
            <el-table-column type="index" width="30" fixed align="center" />
            <template v-for="columnKey in visibleColumnKeys" :key="columnKey">
              <el-table-column v-if="columnKey === 'direction'" prop="direction" label="多空" width="54" align="center" header-align="center" class-name="direction-column" label-class-name="direction-column"><template #default="{row}"><span class="direction-chip" :class="row.direction === '多' ? 'long' : 'short'"><img :src="assetUrl(row.direction === '多' ? 'direction-long.svg' : 'direction-short.svg')" alt="">{{ row.direction === '多' ? '做多' : '做空' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'executionType'" prop="executionType" label="订单类型" width="76"><template #default="{row}"><span class="execution-type-tag" :class="row.executionType === 'highTouch' ? 'is-high-touch' : 'is-low-touch'">{{ row.executionType === 'highTouch' ? '手工单' : '系统单' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'code'" prop="code" width="96"><template #header><SortHeader label="标的代码" :direction="sortState.prop === 'code' ? sortState.direction : null" @sort="toggleSort('code')" /></template><template #default="{row}">{{ row.code }}.{{ row.market }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'name'" prop="name" width="92"><template #header><SortHeader label="标的名称" :direction="sortState.prop === 'name' ? sortState.direction : null" @sort="toggleSort('name')" /></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'price'" prop="price" width="126" align="right" header-align="right"><template #header><SortHeader label="持仓均价/最新价" numeric :direction="sortState.prop === 'price' ? sortState.direction : null" @sort="toggleSort('price')" /></template><template #default="{row}"><span class="dim">{{ money(row.cost) }}</span> / <span :class="row.change>=0?'up':'down'">{{ money(row.price) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'opening'" prop="opening" width="82" align="right" header-align="right"><template #header><SortHeader label="期初数量" numeric :direction="sortState.prop === 'opening' ? sortState.direction : null" @sort="toggleSort('opening')" /></template><template #default="{row}">{{ number(row.opening) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'available'" prop="available" width="82" align="right" header-align="right"><template #header><SortHeader label="可用数量" numeric :direction="sortState.prop === 'available' ? sortState.direction : null" @sort="toggleSort('available')" /></template><template #default="{row}">{{ number(row.available) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'valueWan'" prop="valueWan" width="82" align="right" header-align="right"><template #header><SortHeader label="市值(万)" numeric :direction="sortState.prop === 'valueWan' ? sortState.direction : null" @sort="toggleSort('valueWan')" /></template><template #default="{row}">{{ money(row.valueWan) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'marginOccupied'" prop="marginOccupied" width="92" align="right" header-align="right"><template #header><SortHeader label="保证金占用" numeric :direction="sortState.prop === 'marginOccupied' ? sortState.direction : null" @sort="toggleSort('marginOccupied')" /></template><template #default="{row}">{{ money(row.marginOccupied) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'marginRate'" prop="marginRate" width="94" align="right" header-align="right"><template #header><SortHeader label="保证金率(%)" numeric :direction="sortState.prop === 'marginRate' ? sortState.direction : null" @sort="toggleSort('marginRate')" /></template><template #default="{row}">{{ row.marginRate.toFixed(2) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'totalProfit'" prop="totalProfit" width="104" align="right" header-align="right"><template #header><span class="profit-heading"><SortHeader label="总盈亏" numeric :direction="sortState.prop === 'totalProfit' ? sortState.direction : null" @sort="toggleSort('totalProfit')" /><el-tooltip content="总盈亏 = 日内实现盈亏 + 浮动盈亏" placement="top" popper-class="order-help-popper"><button type="button" class="total-help" aria-label="总盈亏说明"><el-icon><InfoFilled /></el-icon></button></el-tooltip></span></template><template #default="{row}"><span :class="row.totalProfit >= 0 ? 'up' : 'down'">{{ money(row.totalProfit) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'dailyRealizedProfit'" prop="dailyRealizedProfit" width="104" align="right" header-align="right"><template #header><SortHeader label="日内实现盈亏" numeric :direction="sortState.prop === 'dailyRealizedProfit' ? sortState.direction : null" @sort="toggleSort('dailyRealizedProfit')" /></template><template #default="{row}"><span :class="row.dailyRealizedProfit >= 0 ? 'up' : 'down'">{{ money(row.dailyRealizedProfit) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'floatingProfit'" prop="floatingProfit" width="92" align="right" header-align="right"><template #header><SortHeader label="浮动盈亏" numeric :direction="sortState.prop === 'floatingProfit' ? sortState.direction : null" @sort="toggleSort('floatingProfit')" /></template><template #default="{row}"><span :class="row.floatingProfit >= 0 ? 'up' : 'down'">{{ money(row.floatingProfit) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'account'" prop="account" label="账户" width="76" />
              <el-table-column v-else-if="columnKey === 'market'" prop="market" label="市场" width="58"><template #default="{row}">{{ row.market === 'SZ' ? '深市' : '沪市' }}</template></el-table-column>
            </template>
            <el-table-column label="操作" width="72" fixed="right" align="center" header-align="center" class-name="operation-column" label-class-name="operation-column"><template #default="{ row }"><div class="row-actions"><button type="button" @click.stop="openChaseOrder(row)">追</button><button type="button" @click.stop="openClosePosition(row)">平</button></div></template></el-table-column>
            <el-table-column width="22" fixed="right" align="center" header-align="center" class-name="column-config-column" label-class-name="column-config-column"><template #header><ColumnConfigPopover v-model="visibleColumnKeys" :options="columnOptions" :defaults="positionColumnDefaults" /></template></el-table-column>
          </TradingTable><footer class="positions-footer"><span>显示 {{ filtered.length }} / {{ allRows.length }} 条</span></footer>
        </template>
        <template v-else-if="tab==='orders'">
          <div class="order-filters">
            <el-input v-model="orderFilters.symbol" :prefix-icon="Search" placeholder="标的名称 / 代码" aria-label="搜索委托标的" clearable />
            <el-select v-model="orderFilters.side" aria-label="买卖方向筛选" popper-class="variant-popper"><el-option label="买卖方向" value="ALL"/><el-option label="买入" value="buy"/><el-option label="卖出" value="sell"/></el-select>
            <el-select v-model="orderFilters.openClose" aria-label="开平类型筛选" popper-class="variant-popper"><el-option label="开平类型" value="ALL"/><el-option label="开仓" value="开"/><el-option label="平仓" value="平"/></el-select>
            <el-select v-model="orderFilters.status" class="order-status-filter" multiple collapse-tags :max-collapse-tags="1" placeholder="状态" aria-label="状态筛选" popper-class="variant-popper order-status-popper"><template #header><div class="order-status-filter-actions"><button type="button" @click.stop="selectAllOrderStatuses">全选</button><i></i><button type="button" @click.stop="invertOrderStatuses">反选</button></div></template><el-option v-for="option in orderStatusOptions" :key="option.value" :label="option.label" :value="option.value"><el-checkbox :model-value="orderFilters.status.includes(option.value)" @click.stop @change="toggleOrderStatus(option.value)">{{ option.label }}</el-checkbox></el-option></el-select>
            <el-button class="filter-query" @click="applyOrderFilters">查询</el-button><el-button link @click="clearOrderFilters">重置</el-button>
            <el-tooltip content="导出当前筛选结果" placement="top"><button class="export-orders" aria-label="导出委托记录" @click="exportOrders"><el-icon><Download /></el-icon></button></el-tooltip>
          </div>
          <TradingTable class="original-fields orders-table" :data="sortedOrders" height="100%" empty-text="暂无委托记录">
            <el-table-column type="index" label="序号" width="48" fixed="left" align="center" header-align="center" class-name="order-index-column" label-class-name="order-index-column" />
            <template v-for="columnKey in orderVisibleColumnKeys" :key="columnKey">
              <el-table-column v-if="columnKey === 'code'" prop="code" label="标的代码" width="96"/>
              <el-table-column v-else-if="columnKey === 'name'" prop="name" label="标的名称" width="110"/>
              <el-table-column v-else-if="columnKey === 'status'" prop="status" label="状态" width="82"><template #default="{row}"><span class="order-status" :class="`is-${orderStatusVisual(row.status).tone}`"><el-icon><component :is="orderStatusVisual(row.status).icon" /></el-icon>{{ row.status }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'openClose'" prop="openClose" label="开平" width="64"><template #default="{row}">{{ row.openClose === '开' ? '开仓' : '平仓' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'side'" label="买卖" width="64"><template #default="{row}"><span :class="row.side==='buy'?'up':'down'">{{ row.side==='buy'?'买入':'卖出' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'attribute'" prop="attribute" label="委托方式" width="82"><template #default="{row}">{{ row.type === 'market' ? '市价单' : '限价单' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'price'" prop="price" width="98" align="right" header-align="right"><template #header><SortHeader label="委托价格" numeric :direction="orderSortState.prop === 'price' ? orderSortState.direction : null" @sort="toggleOrderSort('price')" /></template><template #default="{row}">{{ row.price === null ? '--' : money(row.price) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderValueNumber'" prop="quantity" width="98" align="right" header-align="right"><template #header><SortHeader label="委托数量" numeric :direction="orderSortState.prop === 'quantity' ? orderSortState.direction : null" @sort="toggleOrderSort('quantity')" /></template><template #default="{row}">{{ number(row.quantity) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledQuantity'" prop="filledQuantity" width="98" align="right" header-align="right"><template #header><SortHeader label="成交数量" numeric :direction="orderSortState.prop === 'filledQuantity' ? orderSortState.direction : null" @sort="toggleOrderSort('filledQuantity')" /></template><template #default="{row}">{{ number(row.filledQuantity || 0) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledPrice'" prop="filledPrice" width="92" align="right" header-align="right"><template #header><SortHeader label="成交均价" numeric :direction="orderSortState.prop === 'filledPrice' ? orderSortState.direction : null" @sort="toggleOrderSort('filledPrice')" /></template><template #default="{row}">{{ row.filledPrice === null ? '--' : money(row.filledPrice) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledAmount'" label="成交金额" width="106" align="right" header-align="right"><template #default="{row}">{{ filledAmount(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'canceledValue'" label="撤单数量/金额" width="124" align="right" header-align="right"><template #default="{row}">{{ canceledOrderValue(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'account'" prop="account" label="下单账户" width="146"><template #default="{row}">{{ accountLabel(row.account) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'frozenMargin'" prop="frozenMargin" label="冻结保证金" width="106" align="right" header-align="right"><template #default="{row}">{{ money(row.frozenMargin || 0) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'executionType'" prop="executionType" label="订单类型" width="80"><template #default="{row}"><span class="execution-type-tag" :class="row.executionType === 'highTouch' ? 'is-high-touch' : 'is-low-touch'">{{ row.executionType === 'highTouch' ? '手工单' : '系统单' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'marginRate'" prop="marginRate" label="保证金率" width="82" align="right" header-align="right"><template #default="{row}">{{ row.marginRate || 0 }}%</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'feedback'" prop="feedback" label="反馈信息" width="138" show-overflow-tooltip><template #default="{row}">{{ row.feedback || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderNo'" prop="orderNo" label="订单编号" width="160"/>
              <el-table-column v-else-if="columnKey === 'orderTime'" prop="orderTime" label="下单时间" width="154"/>
              <el-table-column v-else-if="columnKey === 'market'" prop="market" label="市场" width="64"><template #default="{row}">{{ marketLabel(row.market) }}</template></el-table-column>
            </template>
            <el-table-column label="操作" width="78" fixed="right" align="center" class-name="operation-column" label-class-name="operation-column"><template #default="{row}"><div class="order-row-actions"><button type="button" title="追单" aria-label="追单" @click="orderAction(row, '追单')">追</button><button type="button" title="改单" aria-label="改单" @click="orderAction(row, '改单')">改</button><button type="button" title="撤单" aria-label="撤单" @click="orderAction(row, '撤单')">撤</button></div></template></el-table-column>
            <el-table-column width="22" fixed="right" align="center" header-align="center" class-name="column-config-column" label-class-name="column-config-column"><template #header><ColumnConfigPopover v-model="orderVisibleColumnKeys" :options="orderColumnOptions" :defaults="orderColumnDefaults" /></template></el-table-column>
          </TradingTable>
        </template>
        <template v-else>
          <TradingTable class="original-fields trades-table" :data="[]" height="100%" empty-text="暂无成交记录">
            <el-table-column prop="executionType" label="订单类型" width="76"><template #default="{row}"><span class="execution-type-tag" :class="row.executionType === 'highTouch' ? 'is-high-touch' : 'is-low-touch'">{{ row.executionType === 'highTouch' ? '手工单' : '系统单' }}</span></template></el-table-column>
            <el-table-column prop="side" label="买卖" width="54"><template #default="{row}"><span :class="row.side === 'buy' ? 'up' : 'down'">{{ row.side === 'buy' ? '买' : '卖' }}</span></template></el-table-column>
            <el-table-column prop="code" label="标的代码" width="92" />
            <el-table-column prop="name" label="标的名称" width="110" />
            <el-table-column prop="filledQuantity" label="成交数量" width="92" align="right" header-align="right" />
            <el-table-column prop="filledPrice" label="成交均价" width="92" align="right" header-align="right" />
            <el-table-column prop="account" label="账户" width="86" />
          </TradingTable>
        </template>
      </section>
      <section class="trade-dock" :class="{floating:dock==='floating', resizing, 'assets-collapsed':assetsCollapsed}" :style="floatStyle">
        <OrderBook v-show="!collapsed" :symbol="selected" :compact="dock === 'bottom'" @drag="start" @quote="value=>{quote=value;collapsed=false}" />
        <section v-show="!collapsed" class="ticket-pane workspace-panel">
          <header class="module-heading drag-heading" @pointerdown="start"><span class="drag-title"><span class="drag-grip" aria-hidden="true"><i v-for="n in 8" :key="n" /></span><h2>交易委托</h2></span><button aria-label="收起交易区域" class="collapse-ticket" @pointerdown.stop @click="collapsed=true"><img :src="assetUrl('panel-collapse.svg')" alt=""></button></header>
          <OrderTicket :instruments="marketInstruments" :accounts="accounts" :symbol="selected" :account="account" :quote="quote" :paused="!systemRunning" @account-select="id=>accountId=id" @select="code=>{ selectedCode=code; if (!code) quote=null }" @order="acceptOrder" />
        </section>
        <section v-show="!collapsed" class="compact-assets ticket-assets" :class="{ 'is-collapsed': assetsCollapsed }" aria-label="账户资金"><div class="asset-summary-heading"><span>资产账户概要</span><button class="asset-visibility" type="button" :aria-label="assetsVisible ? '隐藏资金数值' : '查看资金数值'" @click="toggleAssetsVisible"><el-icon><View v-if="assetsVisible" /><Hide v-else /></el-icon></button><button class="asset-collapse" type="button" :aria-label="assetsCollapsed ? '展开资产账户概要' : '收起资产账户概要'" @click="assetsCollapsed=!assetsCollapsed"><el-icon><ArrowDownBold /></el-icon></button></div><div v-show="!assetsCollapsed" class="asset-summary-grid"><div class="asset-metric asset-available"><span>大账户可用</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(account.cash)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(account.cash) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div><div class="asset-metric"><span>大账户余额</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(accountBalance)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(accountBalance) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div></div></section>
        <button v-if="dock === 'floating'" type="button" class="floating-resize-handle" aria-label="调整下单面板高度" @pointerdown="startResize"><span></span></button>
      </section>
      <div v-if="dragging" class="dock-targets"><div class="dock-target target-left">停靠左侧</div><div class="dock-target target-right">停靠右侧</div><div class="dock-target target-bottom">停靠底部</div><span class="float-instruction">拖至边缘停靠 · 放在中间悬浮</span></div>
    </div>
    <footer class="variant-status"><span class="system-status"><i class="status-dot" :class="{ 'is-interrupted': !systemRunning }"/>{{ systemRunning ? '运行中' : '系统中断' }} · 演示环境<button type="button" class="system-status-toggle" @click="toggleSystemStatus">{{ systemRunning ? '切换为中断' : '恢复运行' }}</button></span><span>行情：静态快照</span><span class="status-end">系统版本：方案 V0.2</span></footer>
    <ClosePositionDialog v-model="closePositionVisible" :position="closingPosition" :account="account" @submit="acceptClosePosition" />
    <ChaseOrderDialog v-model="chaseOrderVisible" :position="chasingPosition" :account="account" @submit="acceptChaseOrder" />
    <el-dialog v-model="messageCenterVisible" width="760px" align-center class="message-center-dialog" :show-close="false">
      <template #header><header class="message-center-header"><h2>消息中心</h2><div class="message-header-actions"><button type="button" class="message-close-action" aria-label="关闭消息中心" @click="messageCenterVisible=false"><el-icon><Close /></el-icon></button></div></header></template>
      <div class="message-center-layout"><nav class="message-category-tabs" aria-label="消息分类"><button v-for="category in messageCategories" :key="category" :class="{ active: messageCategory === category }" @click="messageCategory=category"><img class="message-category-icon" :src="messageIcon(category)" alt=""><span>{{ category }}</span><i v-if="categoryUnreadCount(category)">{{ categoryUnreadCount(category) }}</i></button></nav>
        <section class="message-list" aria-label="消息列表"><header><div class="message-list-heading"><b>{{ messageCategory }}</b><span v-if="categoryUnreadCount(messageCategory)" class="message-list-actions"><strong>{{ categoryUnreadCount(messageCategory) }}</strong> 条未读</span></div><button v-if="unreadMessageCount" type="button" class="mark-all-read" @click="markAllMessagesRead">全部标为已读</button></header><article v-for="message in filteredMessages" :key="message.id" class="message-item" :class="[`is-${message.category}`, { unread: message.unread, expanded: messageIsExpanded(message) }]" @click="markMessageRead(message)"><span class="message-type-icon"><img :src="messageIcon(message.category)" alt=""></span><div class="message-copy"><span class="message-title-row"><b>{{ message.title }}</b><em>{{ message.category }}</em></span><p>{{ message.content }}</p><button v-if="needsExpansion(message)" type="button" @click.stop="toggleMessageExpansion(message)">{{ messageIsExpanded(message) ? '收起' : '展开全部' }}</button></div><time>{{ message.time }}</time><i v-if="message.unread" aria-label="未读"></i></article><p v-if="!filteredMessages.length" class="message-empty">当前分类暂无消息</p></section>
      </div>
    </el-dialog>
    <el-dialog v-model="emergencyMessage" width="420px" align-center class="emergency-message-dialog" title="紧急通知"><section v-if="emergencyMessage"><h3>{{ emergencyMessage.title }}</h3><p>{{ emergencyMessage.content }}</p></section><template #footer><el-button type="primary" @click="emergencyMessage=null">我知道了</el-button></template></el-dialog>
    <el-dialog v-model="settingsVisible" class="settings-dialog equity-settings-dialog" width="700px" :show-close="false" :close-on-click-modal="true" destroy-on-close>
      <template #header><div class="settings-title"><h2>系统设置</h2><button @click="settingsVisible=false"><el-icon><Close /></el-icon></button></div></template>
      <div class="settings-layout"><nav class="settings-nav"><button v-for="item in settingMenu" :key="item.key" :class="{ active: activeSetting === item.key }" @click="scrollToSetting(item.key)"><SettingsMenuIcon :name="item.key" />{{ item.label }}</button></nav><el-scrollbar class="settings-content"><section id="equity-account-setting" class="settings-section"><h3>账号信息</h3><div class="setting-row"><span>登录密码</span><el-button plain>修改密码</el-button></div><div class="setting-row"><span>开机启动</span><el-switch v-model="autoLaunch" /></div></section><section id="equity-language-setting" class="settings-section"><h3>语言设置</h3><div class="setting-row"><span>显示语言</span><el-radio-group v-model="language" class="settings-radio-group"><el-radio class="settings-radio" value="简体中文">简体中文</el-radio><el-radio class="settings-radio" value="繁體中文">繁體中文</el-radio><el-radio class="settings-radio" value="English">English</el-radio></el-radio-group></div></section><section id="equity-trading-setting" class="settings-section"><h3>交易与行情设置</h3><div class="setting-row"><span>委托价设置</span><el-radio-group v-model="orderPrice" class="settings-radio-group"><el-radio class="settings-radio" value="买一">买一</el-radio><el-radio class="settings-radio" value="卖一">卖一</el-radio><el-radio class="settings-radio" value="最新价">最新价</el-radio></el-radio-group></div><div class="setting-row"><span>涨跌幅颜色</span><el-radio-group v-model="colorRule" class="settings-radio-group"><el-radio class="settings-radio" value="red-up">红涨绿跌</el-radio><el-radio class="settings-radio" value="green-up">绿涨红跌</el-radio></el-radio-group></div><div class="price-preview" :class="pricePreviewClass"><span class="up">↑ 2.48%</span><span class="down">↓ 1.36%</span></div></section><section id="equity-appearance-setting" class="settings-section"><h3>系统外观</h3><div class="setting-row"><span>主题模式</span><el-radio-group v-model="theme" class="settings-radio-group"><el-radio class="settings-radio" value="dark">深色模式</el-radio><el-radio class="settings-radio" value="light">浅色模式</el-radio></el-radio-group></div><div class="theme-cards"><button :class="{ selected: theme === 'dark' }" @click="theme='dark'"><span class="mini-screen dark"><i /><b /><em /><em /><em /></span>深色模式</button><button :class="{ selected: theme === 'light' }" @click="theme='light'"><span class="mini-screen light"><i /><b /><em /><em /><em /></span>浅色模式</button></div></section></el-scrollbar></div>
      <template #footer><div class="settings-footer"><el-button @click="settingsVisible=false">取 消</el-button><el-button type="primary" @click="saveSettings">保存设置</el-button></div></template>
    </el-dialog>
  </main>
</template>
