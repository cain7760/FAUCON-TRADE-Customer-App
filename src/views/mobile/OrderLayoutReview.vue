<script setup>
import { ref } from 'vue'
import CustomerMobileApp from './CustomerMobileApp.vue'

const props = defineProps({ initialLayout: { type: String, default: 'split' } })
const layout = ref(props.initialLayout)
const options = [{ value: 'stacked', label: 'A 上下' }, { value: 'split', label: 'B 左右' }]
</script>

<template>
  <div class="order-layout-review">
    <header class="order-review-toolbar">
      <h1>下单方案评审</h1>
      <div class="order-review-options" role="group" aria-label="下单布局方案">
        <button v-for="option in options" :key="option.value" type="button" :aria-pressed="layout === option.value" @click="layout = option.value">{{ option.label }}</button>
      </div>
      <a href="./">退出评审</a>
    </header>
    <CustomerMobileApp :order-layout="layout" order-review />
  </div>
</template>

<style scoped>
.order-layout-review { --order-review-toolbar-height: 48px; }
.order-review-toolbar { display: flex; min-height: var(--order-review-toolbar-height); align-items: center; justify-content: center; gap: 12px; padding: 4px 8px; background: var(--app-color-surface); color: var(--app-color-text); }
.order-review-toolbar h1 { margin: 0; font-size: 13px; font-weight: 600; white-space: nowrap; }
.order-review-options { display: flex; }
.order-review-options button { min-height: 36px; padding: 0 10px; border: 1px solid var(--app-color-frame); border-radius: 0; background: var(--app-color-control); color: var(--app-color-text-secondary); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.order-review-options button:first-child { border-radius: 2px 0 0 2px; }
.order-review-options button:last-child { margin-left: -1px; border-radius: 0 2px 2px 0; }
.order-review-options button[aria-pressed="true"] { position: relative; border-color: var(--app-color-accent); background: var(--app-color-accent-soft); color: var(--app-color-accent); }
.order-review-toolbar a { display: flex; min-height: 36px; align-items: center; color: var(--app-color-text-secondary); font-size: 12px; text-underline-offset: 3px; white-space: nowrap; }
.order-review-toolbar :is(button, a):focus-visible { position: relative; outline: 2px solid var(--app-color-accent); outline-offset: 2px; }
.order-layout-review :deep(.mobile-stage) { min-height: calc(100dvh - var(--order-review-toolbar-height)); }
.order-layout-review :deep(.mobile-app) { height: min(852px, calc(100dvh - var(--order-review-toolbar-height))); }
</style>
