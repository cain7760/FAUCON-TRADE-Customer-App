<script setup>
import { ref, watch } from 'vue'
import CustomerMobileApp from './CustomerMobileApp.vue'

const props = defineProps({ initialDesign: { type: String, default: 'focus' } })
const design = ref(props.initialDesign)
watch(design, value => {
  const url = new URL(location.href)
  url.searchParams.set('appDesign', value)
  history.replaceState(history.state, '', url)
})
</script>

<template>
  <div class="equity-app-review">
    <header class="app-review-toolbar">
      <strong>App 方案评审</strong>
      <div role="group" aria-label="App 设计方案">
        <button type="button" :aria-pressed="design === 'baseline'" @click="design = 'baseline'">现版基线</button>
        <button type="button" :aria-pressed="design === 'focus'" @click="design = 'focus'">新版 · 专注交易</button>
        <button type="button" :aria-pressed="design === 'c'" @click="design = 'c'">方案 C · 持仓详情</button>
      </div>
      <a href="?orderReview=1">下单 A/B</a>
    </header>
    <KeepAlive><CustomerMobileApp :key="design" :design="design" app-review /></KeepAlive>
  </div>
</template>

<style scoped>
.equity-app-review { --app-review-height: 56px; }
.app-review-toolbar { display: flex; min-height: var(--app-review-height); align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px 16px; padding: 6px 12px; background: #1b2330; color: #f1f4f8; font-size: 12px; }
.app-review-toolbar strong { font-weight: 600; }
.app-review-toolbar > div { display: flex; padding: 3px; border-radius: 8px; background: #121821; }
.app-review-toolbar button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 5px; background: none; color: #a8b3c2; cursor: pointer; }
.app-review-toolbar button[aria-pressed="true"] { background: #383329; color: #d8b56a; font-weight: 600; }
.app-review-toolbar a { display: flex; min-height: 32px; align-items: center; color: #c4cdd9; text-underline-offset: 4px; }
.app-review-toolbar :is(button,a):focus-visible { outline: 2px solid #d8b56a; outline-offset: 2px; }
.equity-app-review :deep(.mobile-stage) { min-height: calc(100dvh - var(--app-review-height)); }
.equity-app-review :deep(.mobile-app) { height: min(852px, calc(100dvh - var(--app-review-height))); }
@media (max-width: 640px) {
  .equity-app-review { --app-review-height: 92px; }
  .app-review-toolbar { gap: 2px 12px; }
  .app-review-toolbar > div { order: 1; justify-content: center; width: 100%; }
  .app-review-toolbar button { min-height: 36px; padding-inline: 9px; }
}
</style>
