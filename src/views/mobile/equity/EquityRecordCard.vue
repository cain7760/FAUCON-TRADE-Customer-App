<script setup>
import { computed } from 'vue'
import { averageFillPrice } from './orderCalculations.js'
import EquityOrderStatus from './EquityOrderStatus.vue'
import { formatNumber, price, pnlClass, signedMoney, sideLabel, orderPrice, orderQuantity, fillProgress, accountLabel } from './model.js'
const props = defineProps({ kind: { type: String, required: true }, record: { type: Object, required: true } })
defineEmits(['open', 'action'])
const isChaseActionVisible = false
const progressPercent = computed(() => Number.parseFloat(fillProgress(props.record)))
</script>

<template>
  <article class="equity-record" :class="{ 'record-position': kind === 'positions', 'record-order': kind === 'orders' }">
  <button type="button" class="record-detail-trigger" :aria-label="`查看${record.name}${kind === 'positions' ? '持仓' : kind === 'orders' ? '订单' : '成交'}详情`" @click="$emit('open', $event)">
    <span class="record-heading">
      <span class="record-instrument">
        <span class="record-identity">
          <span class="record-name">{{ record.name }}</span>
          <span v-if="kind === 'positions' || kind === 'orders'" class="record-code">{{ record.code }}.{{ record.market }}<span v-if="kind === 'orders'" class="record-currency">{{ record.currency }}</span></span>
        </span>
        <span v-if="kind === 'trades'" class="record-metadata">
          <span class="record-code">{{ record.code }}.{{ record.market }}<span class="record-currency">{{ record.currency }}</span></span>
        </span>
      </span>
      <span v-if="kind === 'positions'" class="position-account" :aria-label="`下单账户：${accountLabel(record.account)}`">{{ accountLabel(record.account) }}</span>
      <EquityOrderStatus v-else-if="kind === 'orders'" :status="record.status" />
      <span v-else-if="kind === 'trades'" class="record-highlight">
        <span class="record-caption">成交金额</span>
        <strong>{{ formatNumber(record.filledAmount) }}</strong>
      </span>
    </span>

    <template v-if="kind === 'positions'">
      <span class="record-metrics">
        <span><span class="record-caption">持仓均价</span><span class="record-value">{{ price(record.cost, record.market) }}</span></span>
        <span><span class="record-caption">最新价</span><span class="record-value" :class="pnlClass(record.change)">{{ price(record.price, record.market) }}</span></span>
        <span><span class="record-caption">持仓数量（股）</span><span class="record-value">{{ formatNumber(record.qty, 3, false) }}</span></span>
        <span><span class="record-caption">可用数量（股）</span><span class="record-value equity-accent">{{ formatNumber(record.available, 3, false) }}</span></span>
        <span><span class="record-caption">市值</span><span class="record-value">{{ formatNumber(record.value) }}</span></span>
        <span><span class="record-caption" title="沿用 Customer 日内实现盈亏口径">实现盈亏</span><span class="record-value" :class="pnlClass(record.dailyRealizedProfit)">{{ signedMoney(record.dailyRealizedProfit) }}</span></span>
      </span>
    </template>
    <template v-else>
      <span v-if="kind === 'trades'" class="record-context"><span :class="record.side === 'buy' ? 'equity-positive' : 'equity-negative'">{{ sideLabel(record) }}</span><span>{{ record.orderType }}</span></span>
      <span class="record-metrics">
        <span><span class="record-caption">{{ kind === 'orders' ? '订单价格' : '成交均价' }}</span><span class="record-value">{{ kind === 'orders' ? orderPrice(record) : price(averageFillPrice(record), record.market) }}</span></span>
        <span><span class="record-caption">{{ kind === 'orders' ? '订单数量/金额' : '成交数量（股）' }}</span><span class="record-value">{{ kind === 'orders' ? orderQuantity(record) : formatNumber(record.filledQuantity, 3, false) }}</span></span>
        <template v-if="kind === 'orders'">
          <span><span class="record-caption">挂单数量（股）</span><span class="record-value">{{ record.reportQuantity ? formatNumber(record.reportQuantity, 3, false) : '--' }}</span></span>
          <span><span class="record-caption">已成数量（股）</span><span class="record-value">{{ record.filledQuantity ? formatNumber(record.filledQuantity, 3, false) : '--' }}</span></span>
          <span><span class="record-caption">成交均价</span><span class="record-value">{{ price(averageFillPrice(record), record.market) }}</span></span>
          <span><span class="record-caption">成交进度</span><span class="record-progress-value"><progress v-if="Number.isFinite(progressPercent)" class="record-progress-bar" :value="progressPercent" max="100" aria-label="成交进度" :aria-valuetext="fillProgress(record)"></progress><span class="record-value" :aria-hidden="Number.isFinite(progressPercent) ? true : undefined">{{ fillProgress(record) }}</span></span></span>
          <span class="record-order-tags" role="group" aria-label="订单属性"><span class="record-tag" :class="record.side === 'buy' ? 'record-tag-long' : 'record-tag-short'">{{ sideLabel(record) }}</span><span class="record-tag">{{ record.orderType }}</span><span class="record-tag">{{ record.type === 'market' ? '市价单' : '限价单' }}</span></span>
        </template>
        <span v-else><span class="record-caption">执行算法</span><span class="record-value">{{ record.algorithm || '--' }}</span></span>
      </span>
      <span class="record-foot">
        <span v-if="kind === 'orders'"><span class="record-caption">订单编号</span><span class="app-numeric">{{ record.orderNo || '--' }}</span></span>
        <span v-else><span class="record-caption">下单账户</span><span class="record-account">{{ accountLabel(record.account) }}</span></span>
        <span><span class="record-caption">{{ kind === 'orders' ? '订单时间' : '成交时间' }}</span><span class="app-numeric">{{ (kind === 'orders' ? record.orderTime : record.filledTime) || '--' }}</span></span>
      </span>
    </template>
  </button>
  <footer v-if="kind === 'positions'" class="position-card-footer">
    <span class="position-floating-profit"><span class="record-caption">浮动盈亏</span><span class="record-value" :class="pnlClass(record.floatingProfit)">{{ signedMoney(record.floatingProfit) }}</span></span>
    <div v-if="record.direction === '多'" class="record-actions">
      <button v-if="isChaseActionVisible" type="button" class="record-action record-action-chase" :aria-label="`${record.name}追单`" @click="$emit('action', { action: 'chase', event: $event })"><span>追单</span></button>
      <button type="button" class="record-action record-action-close" :aria-label="`${record.name}平仓`" @click="$emit('action', { action: 'close', event: $event })"><span>平仓</span></button>
    </div>
  </footer>
  </article>
</template>
