<script setup>
import { computed, onScopeDispose, ref, watch } from 'vue'
import { povDeadline, povDeadlineText } from '../../../domain/orders/povSchedule.js'

const props = defineProps({ symbol: Object, hours: [Number, String], minutes: [Number, String], active: Boolean })
const now = ref(new Date())
let timer
watch(() => props.active, active => {
  clearInterval(timer)
  now.value = new Date()
  if (active) timer = setInterval(() => { now.value = new Date() }, 1000)
}, { immediate: true })
onScopeDispose(() => clearInterval(timer))
const deadline = computed(() => povDeadline(props.symbol, props.hours, props.minutes, now.value))
const label = computed(() => povDeadlineText(deadline.value))
const detail = computed(() => deadline.value ? `${deadline.value.date} · ${deadline.value.timeZone}` : '')
</script>

<template>
  <div class="pov-deadline"><span>预期截止时间</span><b :title="detail">{{ label }}</b></div>
</template>

<style scoped>
.pov-deadline { margin: 8px 0; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--app-color-text-secondary, #949daa); font-size: 12px; line-height: 18px; }
.pov-deadline b { color: var(--app-color-text, #c8ced7); font-family: var(--app-font-numeric, var(--ft-font-numeric, inherit)); font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
