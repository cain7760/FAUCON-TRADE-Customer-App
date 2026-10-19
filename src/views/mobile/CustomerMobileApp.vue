<script setup>
import { ref } from 'vue'
import dataIcon from '../../assets/mobile-nav/data.svg?no-inline'
import messagesIcon from '../../assets/mobile-nav/messages.svg?no-inline'
import optionsIcon from '../../assets/mobile-nav/options.svg?no-inline'
import profileIcon from '../../assets/mobile-nav/profile.svg?no-inline'
import EquityTrading from './equity/EquityTrading.vue'

const activeTab = ref('equity')
const isEquityOverlayOpen = ref(false)
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
  { id: 'options', label: '期权', icon: optionsIcon, iconSize: 16 },
  { id: 'data', label: '数据', icon: dataIcon, iconSize: 16 },
  { id: 'messages', label: '消息', icon: messagesIcon },
  { id: 'profile', label: '我的', icon: profileIcon },
]
</script>

<template>
  <div class="mobile-stage">
    <main class="mobile-app" aria-label="猎盈 Customer App">
      <header class="status-bar" aria-label="系统状态栏" :inert="isEquityOverlayOpen ? true : undefined">
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
        <EquityTrading v-show="activeTab === 'equity'" @overlay-change="isEquityOverlayOpen = $event" />
      </section>

      <nav class="bottom-nav" aria-label="主导航" :inert="isEquityOverlayOpen ? true : undefined">
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
            class="nav-item"
            @keydown.enter.prevent="activeTab = tab.id"
            @keydown.space.prevent="activeTab = tab.id"
          >
            <template #icon="{ active }">
              <span v-if="Array.isArray(tab.icon)" class="source-composite bottom-equity-icon" :class="{ active }" aria-hidden="true">
                <img
                  v-for="layer in tab.icon"
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
