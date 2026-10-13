<script setup>
import { computed, ref } from 'vue'
import { account, formatMoney, formatNumber, initialOrders, marketInstruments, positions } from './mockData'

const activeTab = ref('home')
const activeOrderFilter = ref('全部')
const searchText = ref('')
const selectedInstrument = ref(marketInstruments[0])
const selectedOrder = ref(null)
const sheet = ref(null)
const toast = ref('')
const orders = ref(initialOrders.map(item => ({ ...item })))
const watchlist = ref(['000001', '600036', '600519'])
const tradeForm = ref({ side: '买入', type: '限价单', price: '11.78', quantity: '100', note: '' })
const amendForm = ref({ price: '', quantity: '' })

const navItems = [
  { key: 'home', label: '首页', icon: '⌂' },
  { key: 'trade', label: '交易', icon: '⇅' },
  { key: 'orders', label: '订单', icon: '▤' },
  { key: 'assets', label: '资产', icon: '▥' },
  { key: 'profile', label: '我的', icon: '◉' },
]

const filteredMarket = computed(() => marketInstruments.filter(item => `${item.name}${item.code}`.includes(searchText.value.trim())))
const visibleOrders = computed(() => activeOrderFilter.value === '全部' ? orders.value : orders.value.filter(item => item.status === activeOrderFilter.value))
const canOperate = order => ['待报', '已报', '部成'].includes(order.status)
const orderValue = computed(() => {
  const price = tradeForm.value.type === '市价单' ? selectedInstrument.value.price : Number(tradeForm.value.price)
  return Math.max(0, price * Number(tradeForm.value.quantity || 0))
})

function changeTab(tab) {
  activeTab.value = tab
  sheet.value = null
}
function changeInstrument(item) {
  selectedInstrument.value = item
  tradeForm.value.price = String(item.price)
  activeTab.value = 'trade'
}
function toggleWatch(item) {
  watchlist.value = watchlist.value.includes(item.code)
    ? watchlist.value.filter(code => code !== item.code)
    : [...watchlist.value, item.code]
}
function showToast(message) {
  toast.value = message
  window.setTimeout(() => { toast.value = '' }, 2200)
}
function openOrderDetail(order) {
  selectedOrder.value = order
  sheet.value = 'detail'
}
function openAmend(order = selectedOrder.value) {
  amendForm.value = { price: order.price ?? selectedInstrument.value.price, quantity: order.quantity }
  selectedOrder.value = order
  sheet.value = 'amend'
}
function submitOrder() {
  if (!Number(tradeForm.value.quantity)) {
    showToast('请输入订单数量')
    return
  }
  sheet.value = 'confirm'
}
function confirmOrder() {
  const isLimit = tradeForm.value.type === '限价单'
  const instrument = selectedInstrument.value
  const now = new Date()
  orders.value.unshift({
    id: `WT${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`,
    name: instrument.name,
    code: `${instrument.code}.${instrument.market}`,
    side: tradeForm.value.side,
    attribute: '开仓',
    orderType: tradeForm.value.type,
    price: isLimit ? Number(tradeForm.value.price) : null,
    quantity: Number(tradeForm.value.quantity),
    filledQuantity: 0,
    filledPrice: null,
    status: '待报',
    submittedAt: '刚刚',
    note: tradeForm.value.note,
  })
  sheet.value = null
  activeTab.value = 'orders'
  showToast('订单已提交，等待上手方反馈')
}
function saveAmendment() {
  if (!selectedOrder.value || !Number(amendForm.value.quantity)) return
  selectedOrder.value.price = selectedOrder.value.orderType === '市价单' ? null : Number(amendForm.value.price)
  selectedOrder.value.quantity = Number(amendForm.value.quantity)
  selectedOrder.value.status = '已报'
  sheet.value = 'detail'
  showToast('改单申请已提交')
}
function cancelOrder() {
  if (!selectedOrder.value) return
  selectedOrder.value.status = '已撤'
  sheet.value = null
  showToast('撤单申请已提交')
}
</script>

<template>
  <main class="mobile-app">
    <header class="app-header">
      <template v-if="activeTab === 'home'"><div><p class="eyebrow">早上好，Kevin</p><h1>猎盈交易</h1></div><button class="round-button" aria-label="消息">◌<i /></button></template>
      <template v-else-if="activeTab === 'trade'"><button class="back-button" @click="changeTab('home')">‹</button><div class="header-title"><b>权益交易</b><span>{{ selectedInstrument.name }} · {{ selectedInstrument.code }}.{{ selectedInstrument.market }}</span></div><button class="header-action" @click="toggleWatch(selectedInstrument)">{{ watchlist.includes(selectedInstrument.code) ? '已自选' : '加自选' }}</button></template>
      <template v-else><div><p class="eyebrow">权益交易</p><h1>{{ ({ orders: '订单', assets: '资产', profile: '我的' })[activeTab] }}</h1></div><button v-if="activeTab === 'orders'" class="round-button" aria-label="筛选">⌘</button></template>
    </header>

    <section class="page-content">
      <template v-if="activeTab === 'home'">
        <section class="asset-hero">
          <div class="hero-top"><span>总资产（CNY）</span><button aria-label="隐藏金额">◉</button></div>
          <strong>{{ formatMoney(account.totalAsset) }}</strong>
          <div class="asset-split"><span>可用 <b>{{ formatMoney(account.available) }}</b></span><span>持仓市值 <b>{{ formatMoney(account.marketValue) }}</b></span></div>
          <button class="asset-arrow" @click="changeTab('assets')">查看资产明细 <span>›</span></button>
        </section>

        <div class="section-heading"><h2>市场行情</h2><button @click="changeTab('trade')">全部行情 <span>›</span></button></div>
        <section class="index-grid"><article><span>上证指数</span><b class="rise">3,286.12</b><small class="rise">+0.32%</small></article><article><span>深证成指</span><b class="rise">10,557.42</b><small class="rise">+0.58%</small></article><article><span>创业板指</span><b class="fall">2,198.64</b><small class="fall">-0.21%</small></article></section>

        <div class="section-heading"><h2>自选</h2><button @click="changeTab('trade')">管理 <span>›</span></button></div>
        <section class="surface list-surface">
          <button v-for="item in marketInstruments.filter(item => watchlist.includes(item.code))" :key="item.code" class="quote-row" @click="changeInstrument(item)"><div><b>{{ item.name }}</b><span>{{ item.code }} · {{ item.market }}</span></div><div :class="item.change >= 0 ? 'rise' : 'fall'"><b>{{ item.price.toFixed(2) }}</b><span>{{ item.change >= 0 ? '+' : '' }}{{ item.change.toFixed(2) }}%</span></div></button>
        </section>

        <div class="section-heading"><h2>待处理订单</h2><button @click="changeTab('orders')">查看全部 <span>›</span></button></div>
        <section class="surface list-surface compact"><button v-for="order in orders.filter(canOperate).slice(0, 2)" :key="order.id" class="pending-row" @click="openOrderDetail(order)"><div><b>{{ order.name }}</b><span>{{ order.id }}</span></div><div><em :class="order.side === '买入' ? 'buy' : 'sell'">{{ order.side }}</em><strong>{{ order.status }}</strong></div></button><p v-if="!orders.some(canOperate)" class="empty-line">暂无待处理订单</p></section>
      </template>

      <template v-else-if="activeTab === 'trade'">
        <section class="quote-panel"><div><span>{{ selectedInstrument.name }} {{ selectedInstrument.code }}.{{ selectedInstrument.market }}</span><strong :class="selectedInstrument.change >= 0 ? 'rise' : 'fall'">{{ selectedInstrument.price.toFixed(2) }}</strong></div><div><b :class="selectedInstrument.change >= 0 ? 'rise' : 'fall'">{{ selectedInstrument.change >= 0 ? '+' : '' }}{{ selectedInstrument.change.toFixed(2) }}%</b><span>今开 11.72　最高 {{ selectedInstrument.high }}</span></div></section>
        <label class="search-box"><span>⌕</span><input v-model="searchText" placeholder="搜索证券代码或名称" /></label>
        <section v-if="searchText" class="surface instrument-results"><button v-for="item in filteredMarket" :key="item.code" @click="changeInstrument(item)"><span><b>{{ item.name }}</b><small>{{ item.code }}.{{ item.market }}</small></span><strong :class="item.change >= 0 ? 'rise' : 'fall'">{{ item.price.toFixed(2) }}</strong></button></section>
        <section class="trade-card"><div class="side-tabs"><button :class="{ active: tradeForm.side === '买入' }" @click="tradeForm.side = '买入'">买入</button><button :class="{ active: tradeForm.side === '卖出' }" @click="tradeForm.side = '卖出'">卖出</button></div><div class="form-title"><b>下单账户</b><button>TZS_T0 · 自营一号 <span>⌄</span></button></div><div class="form-row"><label>订单类型</label><div class="segment"><button :class="{ selected: tradeForm.type === '限价单' }" @click="tradeForm.type = '限价单'">限价</button><button :class="{ selected: tradeForm.type === '市价单' }" @click="tradeForm.type = '市价单'">市价</button></div></div><div class="form-field"><label>订单价格</label><div :class="{ disabled: tradeForm.type === '市价单' }"><input v-model="tradeForm.price" type="number" :disabled="tradeForm.type === '市价单'" /><span>{{ tradeForm.type === '市价单' ? '市价成交' : 'CNY' }}</span></div></div><div class="form-field"><label>订单数量</label><div><input v-model="tradeForm.quantity" inputmode="numeric" type="number" /><span>股</span></div></div><div class="available-line"><span>最大{{ tradeForm.side === '买入' ? '可买' : '可卖' }}</span><b>{{ tradeForm.side === '买入' ? '2,331,000 股' : '9,300 股' }}</b></div><label class="note-field"><span>备注（选填）</span><textarea v-model="tradeForm.note" maxlength="200" placeholder="请输入备注" /></label><button class="submit-order" :class="tradeForm.side === '买入' ? 'buy-button' : 'sell-button'" @click="submitOrder">{{ tradeForm.side }}</button><p class="estimate">预估金额 <b>{{ formatMoney(orderValue) }} CNY</b></p></section>
      </template>

      <template v-else-if="activeTab === 'orders'">
        <nav class="filter-tabs"><button v-for="filter in ['全部', '待报', '已报', '部成', '完成']" :key="filter" :class="{ active: activeOrderFilter === filter }" @click="activeOrderFilter = filter">{{ filter }}<small v-if="filter === '全部'">{{ orders.length }}</small></button></nav>
        <section class="order-list"><button v-for="order in visibleOrders" :key="order.id" class="order-card" @click="openOrderDetail(order)"><div class="order-top"><span><em :class="order.side === '买入' ? 'buy' : 'sell'">{{ order.side }}</em><b>{{ order.name }}</b><small>{{ order.code }}</small></span><strong :class="`status-${order.status}`">{{ order.status }}</strong></div><div class="order-main"><div><span>订单价格</span><b>{{ order.price ? order.price.toFixed(2) : '市价' }}</b></div><div><span>订单数量</span><b>{{ formatNumber(order.quantity) }} 股</b></div><div><span>已成数量</span><b>{{ formatNumber(order.filledQuantity) }} 股</b></div></div><div class="order-bottom"><span>{{ order.id }}</span><span>{{ order.submittedAt }} <i>›</i></span></div></button><div v-if="!visibleOrders.length" class="empty-state">暂无该状态的订单</div></section>
      </template>

      <template v-else-if="activeTab === 'assets'">
        <section class="asset-hero detailed"><div class="hero-top"><span>总资产（CNY）</span><button aria-label="隐藏金额">◉</button></div><strong>{{ formatMoney(account.totalAsset) }}</strong><div class="profit-line"><span>今日盈亏</span><b class="rise">+{{ formatMoney(account.profit) }}</b><em class="rise">+1.18%</em></div></section>
        <section class="asset-cells surface"><article><span>可用资金</span><b>{{ formatMoney(account.available) }}</b></article><article><span>持仓市值</span><b>{{ formatMoney(account.marketValue) }}</b></article><article><span>冻结资金</span><b>0.00</b></article><article><span>风险度</span><b>26.42%</b></article></section>
        <div class="section-heading"><h2>我的持仓</h2><button>全部 <span>›</span></button></div><section class="surface position-list"><button v-for="position in positions" :key="position.code" @click="changeInstrument(position)"><div><b>{{ position.name }}</b><span>{{ position.code }} · 可用 {{ formatNumber(position.available) }} 股</span></div><div><b :class="position.change >= 0 ? 'rise' : 'fall'">{{ position.price.toFixed(2) }}</b><span :class="position.change >= 0 ? 'rise' : 'fall'">{{ position.change >= 0 ? '+' : '' }}{{ position.change.toFixed(2) }}%</span></div><div><b :class="position.price >= position.cost ? 'rise' : 'fall'">{{ formatMoney((position.price - position.cost) * position.quantity) }}</b><span>浮动盈亏</span></div></button></section>
      </template>

      <template v-else-if="activeTab === 'profile'">
        <section class="profile-card"><div class="profile-avatar">K</div><div><b>{{ account.name }}</b><span>{{ account.accountNo }}</span></div><button>›</button></section><section class="surface menu-list"><button><span>◫</span>账户信息 <i>›</i></button><button><span>◌</span>消息中心 <i>›</i></button><button><span>◒</span>交易与行情设置 <i>›</i></button><button><span>?</span>帮助与客服 <i>›</i></button></section><section class="surface app-version"><span>当前版本</span><b>FAUCON TRADE v0.1.0</b></section></template>
    </section>

    <nav class="bottom-nav"><button v-for="item in navItems" :key="item.key" :class="{ active: activeTab === item.key }" @click="changeTab(item.key)"><span>{{ item.icon }}</span>{{ item.label }}</button></nav>

    <Transition name="fade"><div v-if="toast" class="toast">{{ toast }}</div></Transition>

    <Transition name="sheet"><div v-if="sheet" class="sheet-overlay" @click.self="sheet = null"><section class="bottom-sheet" :class="`sheet-${sheet}`"><div class="sheet-grip" /><template v-if="sheet === 'detail' && selectedOrder"><div class="sheet-heading"><div><p>{{ selectedOrder.id }}</p><h2>{{ selectedOrder.name }} <small>{{ selectedOrder.code }}</small></h2></div><button @click="sheet = null">×</button></div><div class="detail-status"><em :class="selectedOrder.side === '买入' ? 'buy' : 'sell'">{{ selectedOrder.side }}</em><b :class="`status-${selectedOrder.status}`">{{ selectedOrder.status }}</b><span>{{ selectedOrder.attribute }} · {{ selectedOrder.orderType }}</span></div><div class="detail-grid"><span>订单价格 <b>{{ selectedOrder.price ? selectedOrder.price.toFixed(2) : '市价' }}</b></span><span>订单数量 <b>{{ formatNumber(selectedOrder.quantity) }} 股</b></span><span>已成数量 <b>{{ formatNumber(selectedOrder.filledQuantity) }} 股</b></span><span>成交均价 <b>{{ selectedOrder.filledPrice?.toFixed(2) || '--' }}</b></span><span>提交时间 <b>{{ selectedOrder.submittedAt }}</b></span><span>订单备注 <b>{{ selectedOrder.note || '--' }}</b></span></div><div v-if="canOperate(selectedOrder)" class="sheet-actions"><button @click="openAmend(selectedOrder)">改单</button><button class="danger-ghost" @click="cancelOrder">撤单</button></div></template><template v-else-if="sheet === 'amend' && selectedOrder"><div class="sheet-heading"><div><p>订单编号 {{ selectedOrder.id }}</p><h2>修改订单</h2></div><button @click="sheet = 'detail'">×</button></div><div class="amend-notice">仅可修改未成交部分；订单原始参数与状态将保留在历史记录中。</div><label class="sheet-field">订单价格 <div :class="{ disabled: selectedOrder.orderType === '市价单' }"><input v-model="amendForm.price" type="number" :disabled="selectedOrder.orderType === '市价单'" /><span>{{ selectedOrder.orderType === '市价单' ? '市价' : 'CNY' }}</span></div></label><label class="sheet-field">订单数量 <div><input v-model="amendForm.quantity" type="number" /><span>股</span></div></label><button class="primary-wide" @click="saveAmendment">确认改单</button></template><template v-else-if="sheet === 'confirm'"><div class="sheet-heading"><div><p>请确认下单信息</p><h2>{{ tradeForm.side }} {{ selectedInstrument.name }}</h2></div><button @click="sheet = null">×</button></div><div class="confirm-quote"><strong :class="tradeForm.side === '买入' ? 'rise' : 'fall'">{{ selectedInstrument.price.toFixed(2) }}</strong><span>{{ selectedInstrument.code }}.{{ selectedInstrument.market }}</span></div><div class="confirm-list"><span>下单账户 <b>TZS_T0 · 自营一号</b></span><span>订单类型 <b>{{ tradeForm.type }}</b></span><span>订单价格 <b>{{ tradeForm.type === '市价单' ? '市价成交' : `${tradeForm.price} CNY` }}</b></span><span>订单数量 <b>{{ tradeForm.quantity }} 股</b></span><span>预估金额 <b>{{ formatMoney(orderValue) }} CNY</b></span><span>备注 <b>{{ tradeForm.note || '--' }}</b></span></div><button class="primary-wide" :class="tradeForm.side === '买入' ? 'buy-button' : 'sell-button'" @click="confirmOrder">确认{{ tradeForm.side }}</button></template></section></div></Transition>
  </main>
</template>
