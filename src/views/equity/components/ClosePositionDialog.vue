<script setup>
import { ref } from 'vue'
import OrderTicket from './OrderTicket.vue'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, position: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
function submit(order) { emit('submit', order); emit('update:modelValue', false) }
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="平仓" :position="position" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #order><OrderTicket close-mode :instruments="[]" :accounts="[account]" :symbol="position" :account="account" :quote="quote" :paused="false" @order="submit" /></template>
  </PositionOrderDialog>
</template>
