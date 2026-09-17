<script setup>
import { computed, ref, watch } from 'vue'
import { money, number } from '../variantData'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, position: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
const orderType = ref('limit')
const price = ref()
const quantity = ref()
const fraction = ref(0)
const estimatedPrice = computed(() => orderType.value === 'limit' ? price.value : props.position?.price || 0)
const maxBuy = computed(() => estimatedPrice.value > 0 ? Math.floor((props.account?.cash || 0) / estimatedPrice.value / 100) * 100 : 0)
const estimatedAmount = computed(() => (quantity.value || 0) * estimatedPrice.value)
const canBuy = computed(() => quantity.value > 0 && quantity.value <= maxBuy.value && quantity.value % 100 === 0 && (orderType.value === 'market' || price.value > 0))

watch(() => props.position, position => {
  price.value = position?.price
  quantity.value = undefined
  fraction.value = 0
}, { immediate: true })
watch(quote, value => { if (value) { orderType.value = 'limit'; price.value = value.price } })
function size(value) { quantity.value = Math.floor(maxBuy.value * value / 100 / 100) * 100 }
function submit() {
  if (!canBuy.value) return
  const id = Date.now()
  emit('submit', {
    id, orderNo: `WT${id}`, account: props.account.id, code: props.position.code, name: props.position.name,
    executionType: 'lowTouch', type: orderType.value, side: 'buy', openClose: '开', status: '待报', runStatus: '正常',
    attribute: `${orderType.value === 'limit' ? '限价' : '市价'}·数量`, quantity: quantity.value,
    price: orderType.value === 'limit' ? price.value : null, orderValueNumber: quantity.value,
    orderValue: `${number(quantity.value)} 股`, filledQuantity: 0, filledPrice: null, estimate: estimatedAmount.value,
  })
  emit('update:modelValue', false)
}
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="追单" :position="position" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #order>
        <form class="order-form chase-order-form" @submit.prevent="submit">
          <section class="order-type-row"><el-radio-group v-model="orderType" class="order-type"><el-radio-button label="limit">限价</el-radio-button><el-radio-button label="market">市价</el-radio-button></el-radio-group></section>
          <section class="price-block"><template v-if="orderType === 'limit'"><div class="field-caption"><label for="chase-price">委托价格</label></div><el-input-number id="chase-price" v-model="price" :step=".01" :precision="2" :controls="false" /></template><template v-else><div class="field-caption"><span>委托价格</span></div><div class="market-price-note"><b>以市场价格成交</b></div></template></section>
          <section class="quantity-block"><div class="field-caption"><label for="chase-quantity">委托数量</label></div><div class="quantity-input-row"><el-input-number id="chase-quantity" v-model="quantity" placeholder="请输入" :step="100" :precision="0" :controls="false" /><span>股</span></div><el-slider v-model="fraction" :step="1" :marks="{0:'0%',25:'25%',50:'50%',75:'75%',100:'100%'}" @input="size" /></section>
          <section class="submit-block"><div class="trade-buttons"><el-button native-type="submit" class="buy-action" :disabled="!canBuy">买入</el-button></div><div class="chase-order-summary"><div><span>追单数量(股)</span><b>{{ quantity ? number(quantity) : '--' }}</b></div><div><span>预估金额(CNY)</span><b>{{ quantity ? money(estimatedAmount) : '--' }}</b></div><div><span>最大可买(股)</span><b>{{ number(maxBuy) }}</b></div></div></section>
        </form>
    </template>
  </PositionOrderDialog>
</template>
