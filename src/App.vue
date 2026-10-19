<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ExceptionState from './components/ExceptionState.vue'
import { normalizeException } from './components/exceptionStates'
import CustomerMobileApp from './views/mobile/CustomerMobileApp.vue'

const pageName = location.pathname.split('/').pop()
const initialException = pageName && pageName !== 'index.html' ? 'not-found' : normalizeException(new URLSearchParams(location.search).get('exception'))
const raisedException = ref(null)
const isOnline = ref(navigator.onLine)
const activeException = computed(() => !isOnline.value ? 'network' : raisedException.value || initialException)
function updateConnection() { isOnline.value = navigator.onLine }
function handleException(event) { raisedException.value = normalizeException(event.detail?.type) }
function handleAction() {
  if (activeException.value === 'not-found') location.assign(new URL('./', location.href))
  else location.reload()
}
onMounted(() => {
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
  window.addEventListener('faucon:exception', handleException)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
  window.removeEventListener('faucon:exception', handleException)
})
</script>

<template>
  <van-config-provider theme="dark">
    <div v-if="activeException" class="mobile-stage"><main class="mobile-app" aria-label="猎盈 Customer App"><ExceptionState :type="activeException" mobile @action="handleAction" /></main></div>
    <CustomerMobileApp v-else />
  </van-config-provider>
</template>
