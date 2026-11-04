import { onBeforeUnmount, onMounted, unref, watch } from 'vue'
import { expireOrdersAtClose } from '../domain/orders/marketSession.js'

// 默认沿用真实收盘检查，手动选择演示时间后暂停，避免刚提交的演示单被真实时钟撤销。
export function useOrderSessionExpiry(orders, { demoMode, onTick } = {}) {
  const canceledSnapshots = new Map()
  const fields = ['status', 'canceledQuantity', 'canceledAmount', 'reportQuantity', 'frozenMargin', 'feedback', 'autoCanceledAt']
  const sync = (processPending = true) => {
    if (processPending !== false) onTick?.()
    if (unref(demoMode)) return []
    const before = new Map(orders.value.filter(row => !row.autoCanceledAt).map(row => [row.id, {
      quantity: row.quantity, filledQuantity: row.filledQuantity,
      values: Object.fromEntries(fields.map(key => [key, row[key]])),
    }]))
    const changed = expireOrdersAtClose(orders.value)
    for (const id of changed) if (before.has(id)) canceledSnapshots.set(id, before.get(id))
    return changed
  }
  if (demoMode) watch(demoMode, mode => {
    if (mode !== 'trading') return
    for (const row of orders.value) {
      const saved = canceledSnapshots.get(row.id)
      if (!saved || !row.autoCanceledAt || !['撤单', '部撤'].includes(row.status)
        || row.quantity !== saved.quantity || row.filledQuantity !== saved.filledQuantity) continue
      for (const key of fields) {
        if (saved.values[key] === undefined) delete row[key]
        else row[key] = saved.values[key]
      }
    }
    canceledSnapshots.clear()
  }, { flush: 'sync' })
  let timer
  sync()
  // 数据变更只检查收盘；午休申请由定时/显式刷新处理，避免失败重试触发递归更新。
  watch(orders, () => sync(false), { deep: true })
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
