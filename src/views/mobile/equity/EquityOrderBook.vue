<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { formatNumber } from './model.js'
import { orderBookLevels } from './orderModel.js'
import { pricePrecision } from './orderCalculations.js'
const props = defineProps({ symbol: Object, compact: Boolean })
defineEmits(['quote'])
const depth = ref(5)
const depthList = ref(null)
const levels = computed(() => orderBookLevels(props.symbol, depth.value))
// 无行情只生成显示用档位，不将占位符写入行情或点价数据。
const displayLevels = computed(() => levels.value.length ? levels.value : Array.from({ length: depth.value }, (_, index) => ({ rank: index + 1 })))
const compactSides = computed(() => [
  { key: 'sell', label: '卖', price: 'ask', quantity: 'askQuantity', rows: [...displayLevels.value].reverse() },
  { key: 'buy', label: '买', price: 'bid', quantity: 'bidQuantity', rows: displayLevels.value },
])
const maximumQuantity = computed(() => Math.max(1, ...levels.value.flatMap(row => [row.bidQuantity, row.askQuantity])))
const fillWidth = quantity => Number.isFinite(quantity) ? `${quantity / maximumQuantity.value * 100}%` : '0%'
// 两侧共享滚动区域，切换标的或档数时回到当前盘口顶部。
watch([() => props.symbol?.code, depth], () => nextTick(() => {
  if (depthList.value) depthList.value.scrollTop = 0
}), { immediate: true })
const money = value => formatNumber(value, pricePrecision(props.symbol))
// 仅压缩盘口显示；最多三位小数保留到股，不改变深度条或点价数据。
const number = value => Number.isFinite(value) && value >= 100000
  ? `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })}k`
  : formatNumber(value, 0)
</script>

<template>
  <section class="ticket-book ticket-module" :class="{ 'ticket-book--ten-levels': depth === 10 }" :style="{ '--ticket-book-visible-levels': depth }" aria-label="盘口">
    <header><h3>盘口 <span>· {{ levels.length ? '点价填单' : '暂无行情' }}</span></h3><div class="ticket-segment" role="group" aria-label="盘口档位"><button v-for="item in [5, 10]" :key="item" type="button" :aria-pressed="depth === item" @click="depth = item">{{ item === 5 ? '五档' : '十档' }}</button></div></header>
    <div v-if="compact" class="ticket-compact-book-headings" aria-hidden="true"><span>档位</span><span>价格</span><span>数量</span></div>
    <div v-if="compact" ref="depthList" class="ticket-compact-book-depths" tabindex="0" aria-label="买卖盘口档位，可滚动查看">
      <div v-for="side in compactSides" :key="side.key" class="ticket-compact-book-side" :aria-label="`${side.label}盘档位`">
        <button v-for="row in side.rows" :key="row.rank" type="button" class="ticket-book-level" :class="`ticket-book-level--${side.key}`" :disabled="!levels.length" :aria-label="levels.length ? `${side.label}${row.rank} ${money(row[side.price])}，填入限价` : `${side.label}${row.rank} 暂无行情`" @click="$emit('quote', row[side.price])"><span class="ticket-book-fill" :style="{ width: fillWidth(row[side.quantity]) }" aria-hidden="true"></span><span class="ticket-book-rank">{{ side.label }}{{ row.rank }}</span><b :class="levels.length ? (side.key === 'buy' ? 'equity-positive' : 'equity-negative') : ''">{{ money(row[side.price]) }}</b><span class="ticket-book-quantity">{{ number(row[side.quantity]) }}</span></button>
      </div>
    </div>
    <div v-if="!compact" class="ticket-book-headings" aria-hidden="true">
      <div class="ticket-book-columns ticket-book-columns--buy"><span>买</span><span>数量</span><span>价格</span></div>
      <div class="ticket-book-columns ticket-book-columns--sell"><span>价格</span><span>数量</span><span>卖</span></div>
    </div>
    <div v-if="!compact" ref="depthList" class="ticket-book-depths" tabindex="0" aria-label="买卖盘口档位，可滚动查看">
      <div class="ticket-book-depth" aria-label="买盘档位">
        <button v-for="row in displayLevels" :key="row.rank" type="button" class="ticket-book-level ticket-book-level--buy" :disabled="!levels.length" :aria-label="levels.length ? `买${row.rank} ${money(row.bid)}，填入限价` : `买${row.rank} 暂无行情`" @click="$emit('quote', row.bid)"><span class="ticket-book-fill" :style="{ width: fillWidth(row.bidQuantity) }" aria-hidden="true"></span><span class="ticket-book-rank">买{{ row.rank }}</span><span class="ticket-book-quantity">{{ number(row.bidQuantity) }}</span><b :class="{ 'equity-positive': levels.length }">{{ money(row.bid) }}</b></button>
      </div>
      <div class="ticket-book-depth" aria-label="卖盘档位">
        <button v-for="row in displayLevels" :key="row.rank" type="button" class="ticket-book-level ticket-book-level--sell" :disabled="!levels.length" :aria-label="levels.length ? `卖${row.rank} ${money(row.ask)}，填入限价` : `卖${row.rank} 暂无行情`" @click="$emit('quote', row.ask)"><span class="ticket-book-fill" :style="{ width: fillWidth(row.askQuantity) }" aria-hidden="true"></span><b :class="{ 'equity-negative': levels.length }">{{ money(row.ask) }}</b><span class="ticket-book-quantity">{{ number(row.askQuantity) }}</span><span class="ticket-book-rank">卖{{ row.rank }}</span></button>
      </div>
    </div>
  </section>
</template>
