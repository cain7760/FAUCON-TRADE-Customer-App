<script setup>
import { computed, ref } from 'vue'
import { formatNumber } from './model.js'
import { orderBookLevels } from './orderModel.js'
const props = defineProps({ symbol: Object })
defineEmits(['quote'])
const depth = ref(10)
const levels = computed(() => orderBookLevels(props.symbol, depth.value))
// 沿用 PC 演示快照的价差公式，不将持仓均价冒充昨收。
const delta = computed(() => Number.isFinite(props.symbol?.cost) ? Math.abs(props.symbol.price - props.symbol.cost) : null)
const money = value => formatNumber(value, 2)
const number = value => formatNumber(value, 0)
</script>

<template>
  <section class="ticket-book" aria-label="盘口">
    <header><h3>盘口</h3><div class="ticket-segment" role="group" aria-label="盘口档位"><button v-for="item in [10, 5]" :key="item" type="button" :aria-pressed="depth === item" @click="depth = item">{{ item === 10 ? '十档' : '五档' }}</button></div></header>
    <div class="ticket-book-identity"><span>{{ symbol?.name || '请选择下单标的' }}</span><small v-if="symbol" class="app-numeric">{{ symbol.code }}.{{ symbol.market }}</small></div>
    <div class="ticket-book-quote"><strong class="app-numeric" :class="symbol?.change >= 0 ? 'equity-positive' : 'equity-negative'">{{ levels.length ? money(symbol.price) : '--' }}</strong><span v-if="levels.length && Number.isFinite(symbol.change)" class="app-numeric" :class="symbol.change >= 0 ? 'equity-positive' : 'equity-negative'"><template v-if="delta !== null">{{ symbol.change >= 0 ? '+' : '-' }}{{ money(delta) }} · </template>{{ symbol.change >= 0 ? '+' : '' }}{{ symbol.change.toFixed(2) }}%</span></div>
    <div class="ticket-book-columns"><span>买盘 · 价格 / 股数</span><span>卖盘 · 价格 / 股数</span></div>
    <div v-for="row in levels" :key="row.rank" class="ticket-book-level"><button type="button" :aria-label="`买${row.rank} ${money(row.bid)}，填入限价`" @click="$emit('quote', row.bid)"><span>{{ row.rank }}</span><b class="equity-positive">{{ money(row.bid) }}</b><span>{{ number(row.bidQuantity) }}</span></button><button type="button" :aria-label="`卖${row.rank} ${money(row.ask)}，填入限价`" @click="$emit('quote', row.ask)"><span>{{ row.rank }}</span><b class="equity-negative">{{ money(row.ask) }}</b><span>{{ number(row.askQuantity) }}</span></button></div>
    <p class="ticket-help">{{ levels.length ? '点击价格填入限价单' : '当前无参考行情' }}</p>
  </section>
</template>
