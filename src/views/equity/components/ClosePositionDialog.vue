<script setup>
import { computed, ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { money, number } from '../variantData'
import OrderBook from './OrderBook.vue'
import OrderTicket from './OrderTicket.vue'

const props = defineProps({ modelValue: Boolean, position: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
const marketValueWan = computed(() => ((props.position?.qty || 0) * (props.position?.price || 0) / 10000).toFixed(2))
const iaRatio = computed(() => props.position?.iaRatio ?? 40)
function close() { emit('update:modelValue', false) }
function submit(order) { emit('submit', order); close() }
</script>

<template>
  <el-dialog :model-value="modelValue" top="var(--ft-dialog-top)" width="840px" :teleported="false" :show-close="false" class="close-position-dialog" @update:model-value="emit('update:modelValue', $event)">
    <template #header><header class="close-position-header"><h2>平仓</h2><button type="button" aria-label="关闭平仓" @click="close"><el-icon><Close /></el-icon></button></header></template>
    <div v-if="position && account" class="close-position-layout">
      <section class="close-market"><OrderBook :symbol="position" :ia-ratio="iaRatio" hide-header hide-ticks @quote="quote = $event" /></section>
      <section class="close-order-side ticket-pane">
        <div class="close-position-metrics"><div><span>持仓股数</span><b>{{ number(position.qty) }} 股</b></div><div><span>持仓市值(万)</span><b>{{ marketValueWan }}</b></div><div><span>可平股数</span><b>{{ number(position.available) }} 股</b></div><div><span>成本价</span><b>{{ money(position.cost) }}</b></div></div>
        <OrderTicket close-mode :instruments="[]" :accounts="[account]" :symbol="position" :account="account" :quote="quote" :paused="false" @order="submit" />
      </section>
    </div>
  </el-dialog>
</template>
