<script setup>
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  label: { type: String, required: true },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const show = ref(false), trigger = ref(null)
const container = computed(() => trigger.value?.closest('.mobile-app'))
const text = computed(() => props.options.find(option => option.value === props.modelValue)?.text ?? '请选择')
function confirm({ selectedValues }) {
  if (selectedValues[0] !== undefined) emit('update:modelValue', selectedValues[0])
  show.value = false
}
</script>

<template>
  <button v-bind="$attrs" ref="trigger" type="button" class="app-select-field" :disabled="disabled" :aria-label="`${label}：${text}`" aria-haspopup="dialog" :aria-expanded="show" @click="show = true">
    <span class="app-select-value">{{ text }}</span><i class="app-chevron" aria-hidden="true" />
  </button>
  <van-popup v-model:show="show" round position="bottom" class="app-control-sheet" :aria-label="label" :teleport="container" :style="{ position: 'absolute' }" :overlay-style="{ position: 'absolute' }" @keydown.esc="show = false" @closed="trigger?.focus()">
    <van-picker v-if="show" :title="label" :columns="options" :model-value="[modelValue]" confirm-button-text="确认" cancel-button-text="取消" @confirm="confirm" @cancel="show = false" />
  </van-popup>
</template>
