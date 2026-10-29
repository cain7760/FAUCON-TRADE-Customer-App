<script setup>
import { computed } from 'vue'
import { messageBrief } from '../../../domain/messages/messageCenter.js'

const props = defineProps({ message: { type: Object, required: true }, expanded: Boolean })
const brief = computed(() => messageBrief(props.message))
</script>

<template>
  <span v-if="brief" class="message-brief" :class="{ 'message-brief--detail': expanded }">
    <span class="message-brief-highlight">
      <span class="message-brief-label">{{ brief.highlight.label }}</span>
      <span class="message-brief-value" :class="{ 'app-numeric': brief.highlight.numeric }"><b>{{ brief.highlight.value }}</b><span v-if="brief.highlight.suffix">{{ brief.highlight.suffix }}</span></span>
    </span>
    <span v-for="field in brief.fields" :key="field.label" class="message-brief-field"><span class="message-brief-label">{{ field.label }}</span><span>{{ field.value }}</span></span>
    <span v-if="!expanded" class="message-brief-note">{{ brief.note }}</span>
    <span v-if="brief.steps" class="message-brief-steps" role="list" aria-label="办理步骤">
      <span v-for="(step, index) in brief.steps" :key="step" role="listitem"><span class="message-brief-step-number app-numeric">{{ index + 1 }}</span><span>{{ step }}</span></span>
    </span>
  </span>
  <span v-if="expanded || !brief" class="message-brief-content" :class="{ 'message-brief-content--full': expanded }">{{ message.content }}</span>
</template>

<style scoped>
.message-brief { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--app-color-border); }
.message-brief-highlight { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.message-brief-label { flex: none; color: var(--app-color-text-secondary); font-size: 11px; line-height: 18px; }
.message-brief-value { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; color: var(--app-color-text); line-height: 24px; }
.message-brief-value b { font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.message-brief-value > span { font-size: 13px; }
.message-brief-field { display: flex; align-items: baseline; gap: 10px; color: var(--app-color-text); font-size: 12px; line-height: 19px; }
.message-brief-field > :last-child { min-width: 0; overflow-wrap: anywhere; }
.message-brief-note, .message-brief-content { color: var(--app-color-text-secondary); font-size: 12px; line-height: 19px; overflow-wrap: anywhere; }
.message-brief-steps { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid var(--app-color-border); }
.message-brief-steps > span { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 20px; }
.message-brief-step-number { display: inline-grid; width: 18px; height: 18px; flex: 0 0 18px; place-items: center; border-radius: 50%; background: var(--app-color-accent-soft); color: var(--app-color-accent); font-size: 11px; line-height: 18px; }
.message-brief-content { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin-top: 8px; }
.message-brief--detail { gap: 12px; margin-top: 16px; padding-top: 16px; }
.message-brief--detail .message-brief-value b { font-size: 20px; line-height: 28px; }
.message-brief-content--full { display: block; margin-top: 20px; color: var(--app-color-text); font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
</style>
