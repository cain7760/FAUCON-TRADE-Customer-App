<script setup>
import { computed, ref, watch } from 'vue'
import dataIcon from '../../assets/mobile-nav/data.svg?no-inline'
import messagesIcon from '../../assets/mobile-nav/messages.svg?no-inline'
import optionsIcon from '../../assets/mobile-nav/options.svg?no-inline'
import profileIcon from '../../assets/mobile-nav/profile.svg?no-inline'
import headerGoldArcs from '../../assets/brand/header-gold-arcs.svg'
import EquityTrading from './equity/EquityTrading.vue'
import DataPage from './equity/EquityHistoricalData.vue'
import MessagesPage from '../messages/MessagesPage.vue'
import { createMessageCenter } from '../../store/messageCenter.js'
import { showAppMessage } from '../../plugins/message.js'
import './equity/focus-design.css'
import './equity/concept-c.css'

defineProps({ orderLayout: { type: String, default: 'split' }, orderReview: Boolean, design: { type: String, default: 'baseline' }, appReview: Boolean })

const activeTab = ref('equity')
const equityTrading = ref(null)
let messageStorage
try { messageStorage = globalThis.localStorage } catch { /* 受限环境保留会话内已读状态。 */ }
const messageCenter = createMessageCenter(messageStorage)
const { messages, unread: unreadMessages } = messageCenter
watch(() => equityTrading.value?.readMessageSource() || [], rows => messageCenter.syncOrders(rows), { deep: true, immediate: true })
function openMessageOrder(id, event) {
  if (equityTrading.value?.openMessageOrder(id, event)) activeTab.value = 'equity'
  else showAppMessage('该订单已不存在', 'warning')
}
const readHistorySource = () => equityTrading.value?.readHistorySource() || { orders: [], trades: [] }
const isEquityHome = ref(true)
const isEquityOverlayOpen = ref(false)
const isMessageDetail = ref(false)
const isBottomNavVisible = computed(() => activeTab.value !== 'messages' || !isMessageDetail.value)
const assetUrl = name => `${import.meta.env.BASE_URL}original-icons/${name}`

const tabs = [
  {
    id: 'equity',
    label: '权益',
    icon: [
      ['u76.svg', 0, 0, 14, 9],
      ['u77.svg', 0, 4, 14, 10],
    ],
  },
  { id: 'options', label: '期权', icon: optionsIcon, iconSize: 16, sourceIcon: [['u83.svg', 0, 0, 13, 14], ['u84.svg', 6, 7, 6, 6]] },
  { id: 'data', label: '数据', icon: dataIcon, iconSize: 16 },
  { id: 'messages', label: '消息', icon: messagesIcon },
  { id: 'profile', label: '我的', icon: profileIcon },
]
</script>

<template>
  <div class="mobile-stage">
    <main class="mobile-app" :class="{ 'mobile-app--baseline': design === 'baseline', 'mobile-app--focus': design === 'focus', 'mobile-app--concept-c': design === 'c', 'mobile-app--equity': activeTab === 'equity', 'mobile-app--equity-home': activeTab === 'equity' && isEquityHome }" aria-label="猎盈 Customer App">
      <header class="status-bar" :class="{ 'status-bar--equity': activeTab === 'equity' && isEquityHome }" aria-label="系统状态栏" :inert="isEquityOverlayOpen ? true : undefined">
        <span v-if="design === 'baseline' && activeTab === 'equity' && isEquityHome" class="mobile-equity-brand-mark" aria-hidden="true"><img :src="assetUrl('logo-faucon-trade.png')" alt=""></span>
        <img v-if="design === 'baseline' && activeTab === 'equity' && isEquityHome" class="mobile-equity-brand-wave" :src="headerGoldArcs" alt="" aria-hidden="true">
        <span class="status-time">9:41</span>
        <span class="dynamic-island" aria-hidden="true"></span>
        <span class="status-indicators" aria-hidden="true">
          <svg class="status-cellular" viewBox="0 0 18 14">
            <path d="M1 13V10.5h2V13zm4 0V8h2v5zm4 0V5.5h2V13zm4 0V2h2v11z" />
          </svg>
          <svg class="status-wifi" viewBox="0 0 18 14">
            <path d="M1.5 4.5a11 11 0 0 1 15 0M4.5 7.5a6.7 6.7 0 0 1 9 0M7.5 10.5a2.4 2.4 0 0 1 3 0" />
            <circle cx="9" cy="12.2" r=".8" />
          </svg>
          <svg class="status-battery" viewBox="0 0 25 14">
            <rect x=".75" y="1.25" width="20" height="11.5" rx="3" />
            <path class="battery-level" d="M3.2 3.6h13.4v6.8H3.2z" />
            <path class="battery-cap" d="M22.3 4.7v4.6a2.4 2.4 0 0 0 0-4.6" />
          </svg>
        </span>
      </header>

      <section class="mobile-content" aria-label="页面内容">
        <EquityTrading ref="equityTrading" v-show="activeTab === 'equity'" :order-layout="orderLayout" :order-review="orderReview" :design="design" :app-review="appReview" @overlay-change="isEquityOverlayOpen = $event" @home-change="isEquityHome = $event" />
        <KeepAlive><DataPage v-if="activeTab === 'data'" :design="design" :read-history-source="readHistorySource" @overlay-change="isEquityOverlayOpen = $event" /></KeepAlive>
        <KeepAlive><MessagesPage v-if="activeTab === 'messages'" :messages="messages" @read="messageCenter.markRead($event)" @read-all="messageCenter.markRead()" @open-order="openMessageOrder" @detail-change="isMessageDetail = $event" /></KeepAlive>
      </section>

      <nav v-if="isBottomNavVisible" class="bottom-nav" aria-label="主导航" :inert="isEquityOverlayOpen ? true : undefined">
        <van-tabbar
          v-model="activeTab"
          class="mobile-tabbar"
          :fixed="false"
          :border="false"
          :safe-area-inset-bottom="false"
          aria-label="主菜单"
        >
          <van-tabbar-item
            v-for="tab in tabs"
            :key="tab.id"
            :name="tab.id"
            :badge="tab.id === 'messages' && unreadMessages ? unreadMessages : undefined"
            :badge-props="{ max: 99 }"
            class="nav-item"
            :class="{ 'nav-item--equity': tab.id === 'equity' }"
            @keydown.enter.prevent="activeTab = tab.id"
            @keydown.space.prevent="activeTab = tab.id"
          >
            <template #icon="{ active }">
              <span v-if="Array.isArray(tab.icon) || (design === 'baseline' && tab.sourceIcon)" class="source-composite" :class="{ 'bottom-equity-icon': tab.id === 'equity', 'bottom-options-icon': tab.id === 'options', active }" aria-hidden="true">
                <img
                  v-for="layer in tab.sourceIcon || tab.icon"
                  :key="layer[0]"
                  :src="assetUrl(layer[0])"
                  :style="{
                    left: `${layer[1] * 1.25}px`,
                    top: `${layer[2] * 1.25}px`,
                    width: `${layer[3] * 1.25}px`,
                    height: `${layer[4] * 1.25}px`,
                  }"
                  alt=""
                />
              </span>
              <svg v-else-if="design === 'baseline'" class="bottom-nav-filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                <template v-if="tab.id === 'data'">
                  <path d="M3 8c2.1 1.6 5.4 2.3 9 2.3s6.9-.7 9-2.3v11c0 2.2-4 4-9 4s-9-1.8-9-4V8Z"/>
                  <ellipse class="nav-icon-highlight" cx="12" cy="5" rx="9" ry="4"/>
                </template>
                <template v-else-if="tab.id === 'messages'">
                  <path d="M6 9a6 6 0 0 1 12 0v6l2 3v1H4v-1l2-3V9Zm3 12h6a3 3 0 0 1-6 0Z"/>
                  <path class="nav-icon-highlight" d="M10 2a2 2 0 0 1 4 0v2h-4V2ZM6 9a6 6 0 0 1 12 0H6Z"/>
                </template>
                <template v-else-if="tab.id === 'profile'">
                  <circle class="nav-icon-highlight" cx="12" cy="6" r="5"/>
                  <path d="M3 22v-3a9 7 0 0 1 18 0v3H3Z"/>
                </template>
              </svg>
              <span
                v-else
                class="bottom-nav-icon"
                :style="{
                  '--bottom-nav-icon': `url(${tab.icon})`,
                  '--bottom-nav-item-icon-size': tab.iconSize ? `${tab.iconSize}px` : undefined,
                }"
                aria-hidden="true"
              ></span>
            </template>
            {{ tab.label }}
          </van-tabbar-item>
        </van-tabbar>
      </nav>
    </main>
  </div>
</template>
