<script setup>
import { ref } from 'vue'

const button = ref(null)
defineExpose({ focus: () => button.value?.focus() })
</script>

<template>
  <button ref="button" type="button" class="equity-icon-button equity-sheet-close">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
  </button>
</template>

<style scoped>
.equity-icon-button.equity-sheet-close {
  display: inline-flex; width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  flex-shrink: 0; align-self: center; align-items: center; justify-content: center;
  padding: 0; border: 0; background: transparent; color: var(--app-color-text-secondary);
}
.equity-sheet-close svg {
  width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round;
}
@media (hover: hover) {
  .equity-icon-button.equity-sheet-close:hover { color: var(--app-color-accent); }
}
</style>
