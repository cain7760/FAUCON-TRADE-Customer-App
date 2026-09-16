<script setup>
import { computed, ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { money, number } from '../variantData'
import OrderBook from './OrderBook.vue'

const props = defineProps({ modelValue: Boolean, title: String, position: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'quote'])
const quote = ref(null)
const marketValueWan = computed(() => ((props.position?.qty || 0) * (props.position?.price || 0) / 10000).toFixed(2))
const iaRatio = computed(() => props.position?.iaRatio ?? 40)
function close() { emit('update:modelValue', false) }
function updateQuote(value) { quote.value = value; emit('quote', value) }
</script>

<template>
  <el-dialog :model-value="modelValue" top="var(--ft-dialog-top)" width="700px" :teleported="false" :show-close="false" class="cp-dialog" @update:model-value="emit('update:modelValue', $event)">
    <template #header><header class="cp-header"><h2>{{ title }}</h2><button type="button" :aria-label="`关闭${title}`" @click="close"><el-icon><Close /></el-icon></button></header></template>
    <div v-if="position && account" class="cp-layout">
      <section class="cp-market"><OrderBook :symbol="position" :ia-ratio="iaRatio" hide-header hide-ticks @quote="updateQuote" /></section>
      <section class="cp-order">
        <div class="cp-metrics"><div><span>持仓股数(股)</span><b>{{ number(position.qty) }}</b></div><div><span>持仓市值(万)</span><b>{{ marketValueWan }}</b></div><div><span>可平股数(股)</span><b>{{ number(position.available) }}</b></div><div><span>成本价(CNY)</span><b>{{ money(position.cost) }}</b></div></div>
        <slot name="order" :quote="quote" />
      </section>
    </div>
  </el-dialog>
</template>
