<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { List } from '@element-plus/icons-vue'
import ExceptionState from '../../components/ExceptionState.vue'
import EquityOrderStatus from '../mobile/equity/EquityOrderStatus.vue'
import MessageBrief from './components/MessageBrief.vue'
import { filterMessages, messageCategories, unreadCount } from '../../domain/messages/messageCenter.js'
import { showAppMessage } from '../../plugins/message.js'

const props = defineProps({ messages: { type: Array, default: () => [] } })
const emit = defineEmits(['read', 'read-all', 'open-order', 'detail-change'])
const category = ref('全部'), onlyUnread = ref(false), selectedId = ref(null)
const visibleMessages = computed(() => filterMessages(props.messages, category.value, onlyUnread.value))
const selected = computed(() => props.messages.find(row => row.id === selectedId.value))
watch(() => !!selected.value, value => emit('detail-change', value), { immediate: true, flush: 'sync' })
const unread = computed(() => unreadCount(props.messages))
const heading = ref(null), backButton = ref(null)
let returnFocus
const quantity = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })
const price = value => value == null ? '--' : Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const cardTitle = row => row.order?.status && row.title.endsWith(` · ${row.order.status}`) ? row.title.slice(0, -(` · ${row.order.status}`).length) : row.title
function openMessage(row, event) {
  returnFocus = event.currentTarget
  selectedId.value = row.id
  emit('read', row.id)
  nextTick(() => backButton.value?.focus())
}
function closeMessage() {
  selectedId.value = null
  nextTick(() => returnFocus?.isConnected ? returnFocus.focus() : heading.value?.focus())
}
function readAll() { emit('read-all'); showAppMessage('全部消息已标为已读') }
</script>

<template>
  <section class="messages-page" :class="{ 'messages-page--detail': selected }" aria-label="消息中心">
    <template v-if="selected">
      <header class="messages-detail-heading">
        <button ref="backButton" type="button" class="messages-back" aria-label="返回消息列表" @click="closeMessage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg></button>
        <h1>消息详情</h1><span aria-hidden="true"></span>
      </header>
      <div class="messages-detail-scroll"><article class="messages-detail-card">
        <h2>{{ selected.title }}</h2>
        <time class="app-numeric">{{ selected.time }}</time>
        <p v-if="selected.order" class="messages-content">{{ selected.content }}</p>
        <MessageBrief v-else :message="selected" expanded />
        <dl v-if="selected.order" class="messages-order-fields">
          <div><dt>订单编号</dt><dd class="app-numeric">{{ selected.order.orderNo }}</dd></div>
          <div><dt>下单账户</dt><dd>{{ selected.order.account }}</dd></div>
          <div><dt>订单状态</dt><dd><EquityOrderStatus :status="selected.order.status" /></dd></div>
          <div><dt>订单数量</dt><dd class="app-numeric">{{ quantity(selected.order.quantity) }} 股</dd></div>
          <div><dt>订单限价</dt><dd class="app-numeric">{{ price(selected.order.price) }}</dd></div>
          <div><dt>已成数量</dt><dd class="app-numeric">{{ quantity(selected.order.filledQuantity) }} 股</dd></div>
          <div><dt>成交均价</dt><dd class="app-numeric">{{ price(selected.order.filledPrice) }}</dd></div>
        </dl>
        <van-button v-if="selected.order" block class="messages-order-link" @click="emit('open-order', selected.order.id, $event)">查看订单</van-button>
      </article></div>
    </template>
    <template v-else>
      <header class="messages-heading"><h1 ref="heading" tabindex="-1">消息</h1><button type="button" class="messages-read-all" :disabled="!unread" @click="readAll"><List aria-hidden="true" />全部已读</button></header>
      <van-tabs v-model:active="category" class="equity-list-tabs messages-tabs" :ellipsis="false" :duration="0">
        <van-tab v-for="item in messageCategories" :key="item" :name="item">
          <template #title><span class="equity-tab-title">{{ item }}<span v-if="unreadCount(messages, item)" class="equity-tab-total app-numeric">{{ unreadCount(messages, item) }}</span></span></template>
          <template v-if="category === item">
            <div class="messages-list-toolbar"><span>{{ unreadCount(messages, item) }} 条未读</span><button type="button" :aria-pressed="onlyUnread" @click="onlyUnread = !onlyUnread">只看未读</button></div>
            <div class="messages-scroll" aria-label="消息列表">
              <ul v-if="visibleMessages.length" class="messages-list">
                <li v-for="row in visibleMessages" :key="row.id">
                  <button type="button" class="messages-row" :class="{ 'is-unread': row.unread }" :aria-label="`${row.unread ? '未读，' : ''}${row.title}，${row.time}`" @click="openMessage(row, $event)">
                    <span class="messages-card-heading">
                      <span class="messages-title-row"><b>{{ cardTitle(row) }}</b><span class="app-chevron messages-card-chevron" aria-hidden="true"></span></span>
                      <span class="messages-card-meta"><time class="app-numeric">{{ row.time }}</time><span class="messages-read-state">{{ row.unread ? '未读' : '已读' }}</span></span>
                    </span>
                    <span v-if="row.order" class="messages-card-symbol"><b>{{ row.order.name }}</b><span class="app-numeric">{{ row.order.code }}{{ row.order.market ? `.${row.order.market}` : '' }}</span><EquityOrderStatus :status="row.order.status" /></span>
                    <span v-if="row.order" class="messages-preview">{{ row.content }}</span>
                    <MessageBrief v-else :message="row" />
                    <span v-if="row.order" class="messages-card-metrics"><span><span>订单数量</span><b class="app-numeric">{{ quantity(row.order.quantity) }} 股</b></span><span><span>已成数量</span><b class="app-numeric">{{ quantity(row.order.filledQuantity) }} 股</b></span></span>
                  </button>
                </li>
              </ul>
              <ExceptionState v-else type="empty" :description="onlyUnread ? '当前分类没有未读消息' : '当前分类暂无消息'" mobile compact :show-action="false" />
            </div>
          </template>
        </van-tab>
      </van-tabs>
    </template>
  </section>
</template>

<style scoped>
.messages-page { display: flex; height: 100%; min-height: 0; flex-direction: column; color: var(--app-color-text); background: var(--app-color-background); font-size: 14px; }
:global(.mobile-app--baseline) .messages-page:not(.messages-page--detail) { padding-bottom: var(--mobile-bottom-nav-height); }
.messages-heading, .messages-detail-heading { display: flex; min-height: 56px; flex: none; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 12px; }
.messages-heading h1, .messages-detail-heading h1 { margin: 0; font-size: 21px; font-weight: 650; }
.messages-page button { cursor: pointer; touch-action: manipulation; }
.messages-page button:focus-visible { outline: 2px solid var(--app-color-accent); outline-offset: -2px; }
.messages-page button:disabled { cursor: default; opacity: .4; }
.messages-read-all { display: inline-flex; min-height: 44px; align-items: center; gap: 5px; padding: 0 4px; border: 0; background: transparent; color: var(--app-color-text-secondary); font-size: 12px; }
.messages-read-all svg { width: 16px; height: 16px; }
.messages-list-toolbar { display: flex; min-height: 44px; flex: none; align-items: center; justify-content: space-between; padding: 0 12px; color: var(--app-color-text-secondary); font-size: 12px; }
.messages-list-toolbar button { min-height: 36px; padding: 0 12px; border: 0; border-radius: var(--app-radius-button); background: transparent; color: inherit; font-size: 12px; }
.messages-list-toolbar button[aria-pressed="true"] { background: var(--app-color-accent-soft); color: var(--app-color-accent); }
.messages-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 16px; overscroll-behavior: contain; scrollbar-color: var(--app-color-frame) transparent; scrollbar-width: thin; }
.messages-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.messages-row { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 0; padding: 12px; border: 1px solid var(--app-color-border); border-radius: 10px; background: var(--app-color-card); color: inherit; text-align: left; }
.messages-row.is-unread { border-color: color-mix(in srgb, var(--app-color-accent) 45%, var(--app-color-border)); background: color-mix(in srgb, var(--app-color-accent) 4%, var(--app-color-card)); box-shadow: inset 2px 0 var(--app-color-accent); }
.messages-card-heading { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 4px; }
.messages-card-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; }
.messages-read-state { display: inline-flex; align-items: center; gap: 5px; color: var(--app-color-text-secondary); font-size: 11px; line-height: 18px; }
.is-unread .messages-read-state { color: var(--app-color-accent); font-weight: 600; }
.is-unread .messages-read-state::before { width: 5px; height: 5px; border-radius: 50%; background: currentColor; content: ''; }
.messages-title-row { display: flex; width: 100%; align-items: flex-start; gap: 8px; }
.messages-title-row b { min-width: 0; flex: 0 1 auto; font-size: 15px; font-weight: 700; line-height: 22px; overflow-wrap: anywhere; }
.messages-card-chevron { --app-chevron-size: 16px; align-self: flex-start; margin-top: 3px; margin-left: auto; transform: rotate(-90deg); }
.messages-card-symbol { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 10px; font-size: 13px; line-height: 20px; }
.messages-card-symbol b { font-size: 15px; font-weight: 600; }.messages-card-symbol > .app-numeric { color: var(--app-color-text-secondary); font-size: 12px; }
.messages-card-symbol :deep(.equity-order-status) { flex: none; align-self: center; }
.messages-preview { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin-top: 8px; color: var(--app-color-text-secondary); font-size: 12px; line-height: 19px; overflow-wrap: anywhere; }
.messages-card-symbol + .messages-preview { margin-top: 4px; }
.messages-card-metrics { display: grid; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--app-color-border); color: var(--app-color-text-secondary); font-size: 11px; line-height: 18px; }
.messages-card-metrics > span { display: flex; min-width: 0; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; }
.messages-card-metrics b { color: var(--app-color-text); font-size: 12px; font-weight: 500; overflow-wrap: anywhere; }
.messages-row time, .messages-detail-scroll time { color: var(--app-color-text-secondary); font-size: 11px; line-height: 18px; }
.messages-detail-heading { display: grid; grid-template-columns: 44px 1fr 44px; text-align: center; }
.messages-detail-heading h1 { font-size: 18px; }
.messages-back { display: grid; width: 44px; height: 44px; place-items: center; padding: 0; border: 0; background: transparent; color: var(--app-color-text-secondary); }
.messages-back svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.messages-detail-scroll { min-height: 0; flex: 1; overflow-y: auto; padding: 12px 12px 24px; overscroll-behavior: contain; }
.messages-detail-card { padding: 18px 16px; border-radius: 12px; background: var(--app-color-card); }
.messages-detail-scroll h2 { margin: 0 0 8px; font-size: 20px; line-height: 1.5; overflow-wrap: anywhere; }
.messages-content { margin: 24px 0; font-size: 14px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.messages-order-fields { margin: 0 0 24px; }
.messages-order-fields > div { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--app-color-border); font-size: 12px; }
.messages-order-fields dt { flex: none; color: var(--app-color-text-secondary); }
.messages-order-fields dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
.messages-order-link { border: 0; background: var(--app-color-accent-soft); color: var(--app-color-accent); }
@media (hover: hover) { .messages-row:not(.is-unread):hover { background: var(--app-color-control); }.messages-back:hover, .messages-read-all:not(:disabled):hover { color: var(--app-color-accent); } }
</style>
