import { onBeforeUnmount, onMounted, watch } from 'vue'
import { expireOrdersAtClose } from '../domain/orders/marketSession.js'

// 页面可见时自动检查；后台节流、重新聚焦及重载后的首次读取都会补做检查。
export function useOrderSessionExpiry(orders) {
  const sync = () => expireOrdersAtClose(orders.value)
  let timer
  sync()
  watch(orders, sync, { deep: true })
  onMounted(() => {
    sync()
    timer = window.setInterval(sync, 1000)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
  })
  onBeforeUnmount(() => {
    window.clearInterval(timer)
    window.removeEventListener('focus', sync)
    document.removeEventListener('visibilitychange', sync)
  })
  return sync
}
