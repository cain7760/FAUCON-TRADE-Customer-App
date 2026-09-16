<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Close } from '@element-plus/icons-vue'
import { money, number } from '../variantData'
import OrderBook from './OrderBook.vue'

const props = defineProps({ modelValue: Boolean, position: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const orderType = ref('limit')
const quantityMode = ref('quantity')
const price = ref()
const quantity = ref()
const amount = ref()
const unit = ref('shares')
const amountUnit = ref('yuan')
const fraction = ref(0)
const quote = ref(null)
const displayedAmount = computed({
  get: () => amount.value == null ? undefined : amountUnit.value === 'wan' ? amount.value / 10000 : amount.value,
  set: value => { amount.value = (Number(value) || 0) * (amountUnit.value === 'wan' ? 10000 : 1) },
})
const estimatedPrice = computed(() => orderType.value === 'limit' ? Number(price.value) || 0 : props.position?.price || 0)
const shares = computed(() => quantityMode.value === 'amount'
  ? Math.floor((amount.value || 0) / estimatedPrice.value / 100) * 100
  : (quantity.value || 0) * (unit.value === 'wan' ? 10000 : 1))
const maxSell = computed(() => Math.max(0, props.position?.available || 0))
const canSubmit = computed(() => shares.value > 0 && shares.value <= maxSell.value && shares.value % 100 === 0 && (orderType.value === 'market' || estimatedPrice.value > 0))
const marketValueWan = computed(() => ((props.position?.qty || 0) * (props.position?.price || 0) / 10000).toFixed(2))
const iaRatio = computed(() => props.position?.iaRatio ?? 40)
function reset() { orderType.value = 'limit'; quantityMode.value = 'quantity'; price.value = props.position?.price; quantity.value = undefined; amount.value = undefined; unit.value = 'shares'; amountUnit.value = 'yuan'; fraction.value = 0; quote.value = null }
function close() { emit('update:modelValue', false) }
function stepPrice(direction) { price.value = Number((Math.max(0, (Number(price.value) || 0) + direction * .01)).toFixed(2)) }
function size(value) { const next = Math.floor(maxSell.value * value / 100 / 100) * 100; if (quantityMode.value === 'amount') amount.value = Number((next * estimatedPrice.value).toFixed(2)); else quantity.value = unit.value === 'wan' ? Math.floor(next / 10000) : next }
function submit() {
  if (!canSubmit.value || !props.position) return
  emit('submit', {
    id: `close-${Date.now()}`, orderNo: `PC${Date.now()}`, account: props.position.account, code: props.position.code, name: props.position.name,
    type: orderType.value, side: 'sell', openClose: '平', status: '待报', runStatus: '运行中', attribute: `${orderType.value === 'limit' ? '限价' : '市价'}·${quantityMode.value === 'amount' ? '金额' : '数量'}`,
    quantity: shares.value, price: orderType.value === 'limit' ? price.value : null, orderValueNumber: quantityMode.value === 'amount' ? amount.value : shares.value,
    orderValue: quantityMode.value === 'amount' ? `${money(amount.value || 0)} 元` : `${number(shares.value)} 股`, filledQuantity: 0, filledPrice: null, estimate: estimatedPrice.value * shares.value,
  })
  close()
}
watch(() => props.modelValue, visible => { if (visible) reset() })
watch(() => props.position?.code, reset)
watch([orderType, quantityMode, unit], () => { quantity.value = undefined; amount.value = undefined; fraction.value = 0 })
watch(price, () => { fraction.value = 0 })
watch(quote, value => { if (value) { orderType.value = 'limit'; price.value = value.price } })
</script>

<template>
  <el-dialog :model-value="modelValue" top="var(--ft-dialog-top)" width="960px" append-to-body :show-close="false" class="close-position-dialog" @update:model-value="emit('update:modelValue', $event)">
    <template #header><header class="close-position-header"><div><h2>平仓</h2><p><b>{{ position?.name }}</b><span>（{{ position?.code }}.{{ position?.market }}）</span><em>IA {{ iaRatio }}%</em></p></div><button type="button" aria-label="关闭平仓" @click="close"><el-icon><Close /></el-icon></button></header></template>
    <div v-if="position" class="close-position-layout">
      <section class="close-market"><OrderBook :symbol="position" hide-ticks @quote="quote = $event" /></section>
      <section class="close-order-side">
        <div class="close-position-metrics"><div><span>持仓股数</span><b>{{ number(position.qty) }} 股</b></div><div><span>持仓市值(万)</span><b>{{ marketValueWan }}</b></div><div><span>可平股数</span><b>{{ number(maxSell) }} 股</b></div><div><span>成本价</span><b>{{ money(position.cost) }}</b></div></div>
        <div class="close-order-form">
          <el-radio-group v-model="orderType" class="order-type"><el-radio-button label="limit">限价</el-radio-button><el-radio-button label="market">市价</el-radio-button></el-radio-group>
          <section class="close-field"><label>委托价格</label><template v-if="orderType === 'limit'"><div class="price-input-row"><el-input-number v-model="price" placeholder="请输入" :step=".01" :precision="2" :controls="false" /><span class="price-stepper"><button type="button" aria-label="增加委托价格" @click="stepPrice(1)"><el-icon><ArrowUp /></el-icon></button><button type="button" aria-label="减少委托价格" @click="stepPrice(-1)"><el-icon><ArrowDown /></el-icon></button></span></div></template><div v-else class="market-price-note"><b>以市场价格成交</b></div></section>
          <section class="close-field"><div class="close-field-title"><label>{{ quantityMode === 'quantity' ? '委托数量' : '委托金额' }}</label><el-radio-group v-model="quantityMode" class="quantity-mode" size="small"><el-radio-button label="quantity">数量</el-radio-button><el-radio-button label="amount">金额</el-radio-button></el-radio-group></div><div v-if="quantityMode === 'quantity'" class="quantity-input-row"><el-input-number v-model="quantity" placeholder="请输入" :step="unit === 'wan' ? 1 : 100" :precision="0" :controls="false" /><el-select v-model="unit" aria-label="平仓数量单位" popper-class="variant-popper quantity-unit-popper"><el-option label="股" value="shares" /><el-option label="万股" value="wan" /></el-select></div><div v-else class="quantity-input-row amount-input-row"><el-input-number v-model="displayedAmount" placeholder="请输入" :step="amountUnit === 'wan' ? 1 : 1000" :precision="2" :controls="false" /><el-select v-model="amountUnit" aria-label="平仓金额单位" popper-class="variant-popper quantity-unit-popper"><el-option label="元" value="yuan" /><el-option label="万元" value="wan" /></el-select></div></section>
          <el-slider v-model="fraction" :step="1" :marks="{0:'0%',25:'25%',50:'50%',75:'75%',100:'100%'}" @input="size" />
          <div class="close-capacity"><span>最大可卖</span><b>{{ number(maxSell) }} 股</b></div>
          <el-button class="close-sell-action" :disabled="!canSubmit" @click="submit">卖出</el-button>
          <div class="close-estimates"><div><span>预估卖出金额</span><b>{{ shares ? `${money(shares * estimatedPrice)} CNY` : '--' }}</b></div><div><span>预估卖出股数</span><b>{{ shares ? `${number(shares)} 股` : '--' }}</b></div></div>
        </div>
      </section>
    </div>
  </el-dialog>
</template>
