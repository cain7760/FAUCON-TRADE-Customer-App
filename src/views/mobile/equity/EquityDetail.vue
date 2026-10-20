<script setup>
import { computed, ref } from 'vue'
import { detailSections, listTabs } from './model.js'
const props = defineProps({ kind: { type: String, required: true }, record: { type: Object, required: true }, index: { type: Number, required: true } })
defineEmits(['back'])
const sections = computed(() => detailSections(props.kind, props.record, props.index))
const feedback = ref('')
async function copyIdentifier(field) {
  try {
    await navigator.clipboard.writeText(field.value)
    feedback.value = `${field.label}已复制`
  } catch { feedback.value = '复制失败，请长按编号手动复制' }
}
</script>

<template>
  <section class="equity-detail" :aria-label="listTabs.find(tab => tab.key === kind).detail">
    <header class="detail-header"><button type="button" class="equity-icon-button" aria-label="返回列表" @click="$emit('back')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg></button><h2>{{ listTabs.find(tab => tab.key === kind).detail }}</h2><span></span></header>
    <p v-if="feedback" role="status" class="copy-feedback">{{ feedback }}</p>
    <div class="detail-scroll">
      <div class="detail-symbol"><h3>{{ record.name }}</h3><span class="app-numeric">{{ record.code }}.{{ record.market }}</span></div>
      <section v-for="section in sections" :key="section.title" class="detail-section">
        <h3>{{ section.title }}</h3>
        <dl><div v-for="field in section.fields" :key="field.key" class="detail-field" :class="{ 'detail-field-long': field.multiline }"><dt>{{ field.label }}</dt><dd :class="field.tone"><span :class="{ 'copyable-value': field.copyable, 'app-numeric': field.numeric }">{{ field.value }}</span><button v-if="field.copyable" type="button" class="equity-icon-button copy-button" :aria-label="`复制${field.label}`" @click="copyIdentifier(field)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg></button></dd></div></dl>
        <p v-if="kind !== 'positions' && section.title === '备注'" class="activity-description">订单动态合并展示系统反馈和交易员备注。</p>
      </section>
    </div>
  </section>
</template>
