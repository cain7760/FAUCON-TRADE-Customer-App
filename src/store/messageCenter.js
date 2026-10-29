import { computed, ref } from 'vue'
import { loadMessages, markMessagesRead, saveMessages, syncOrderMessages, unreadCount } from '../domain/messages/messageCenter.js'

// 由 App 容器持有：消息页和底部角标共享同一份状态。
export function createMessageCenter(storage) {
  const state = ref(loadMessages(storage))
  const persist = () => saveMessages(storage, state.value)
  return {
    messages: computed(() => state.value.messages),
    unread: computed(() => unreadCount(state.value.messages)),
    syncOrders(orders) {
      const time = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
      if (syncOrderMessages(state.value, orders, time)) persist()
    },
    markRead(id) { if (markMessagesRead(state.value, id)) persist() },
  }
}
