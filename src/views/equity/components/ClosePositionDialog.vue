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
  <el-dialog :model-value="modelValue" top="var(--ft-dialog-top)" width="540px" :teleported="false" :show-close="false" class="cp-dialog" @update:model-value="emit('update:modelValue', $event)">
    <template #header><header class="cp-header"><h2>平仓</h2><button type="button" aria-label="关闭平仓" @click="close"><el-icon><Close /></el-icon></button></header></template>
    <div v-if="position && account" class="cp-layout">
      <section class="cp-market"><OrderBook :symbol="position" :ia-ratio="iaRatio" hide-header hide-ticks @quote="quote = $event" /></section>
      <section class="cp-order">
        <div class="cp-metrics"><div><span>持仓股数(股)</span><b>{{ number(position.qty) }}</b></div><div><span>持仓市值(万)</span><b>{{ marketValueWan }}</b></div><div><span>可平股数(股)</span><b>{{ number(position.available) }}</b></div><div><span>成本价(CNY)</span><b>{{ money(position.cost) }}</b></div></div>
        <OrderTicket close-mode :instruments="[]" :accounts="[account]" :symbol="position" :account="account" :quote="quote" :paused="false" @order="submit" />
      </section>
    </div>
  </el-dialog>
</template>
