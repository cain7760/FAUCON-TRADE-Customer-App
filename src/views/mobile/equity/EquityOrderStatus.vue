<script setup>
import { computed } from 'vue'
import { orderStatusVisual } from './orderStatus.js'
const props = defineProps({ status: String })
const visual = computed(() => orderStatusVisual(props.status))
</script>

<template>
  <span class="equity-order-status" :class="`is-${visual.tone}`"><svg viewBox="0 0 16 16" aria-hidden="true"><path :d="visual.path" /></svg>{{ status || '--' }}</span>
</template>

<style scoped>
.equity-order-status { display: inline-flex; min-width: 54px; height: 20px; align-items: center; justify-content: center; gap: 3px; padding: 0 5px; border: 1px solid var(--status-border); border-radius: 3px; background: var(--status-background); color: var(--status-color); font-size: 12px; font-weight: 400; line-height: 18px; white-space: nowrap; }
.equity-order-status svg { width: 12px; height: 12px; flex: 0 0 12px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.is-draft { --status-border: #48515d; --status-background: #2a3038; --status-color: #aeb7c2; }
.is-pending { --status-border: #75613a; --status-background: #38301f; --status-color: #dec27b; }
.is-reported { --status-border: #416a7c; --status-background: #243943; --status-color: #86b7cb; }
.is-partial { --status-border: #7a593d; --status-background: #3b2c21; --status-color: #d6a477; }
.is-success { --status-border: #417461; --status-background: #253c34; --status-color: #79bfa8; }
.is-rejected, .is-exception { --status-border: #7b4651; --status-background: #3c282e; --status-color: #e18a96; }
.is-review { --status-border: #655a83; --status-background: #302b3e; --status-color: #ae9bd0; }
</style>
