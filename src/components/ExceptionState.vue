<script setup>
import { computed } from 'vue'
import notFoundIcon from '../assets/exception-icons/not-found.png'
import networkIcon from '../assets/exception-icons/network.png'
import forbiddenIcon from '../assets/exception-icons/forbidden.png'
import maintenanceIcon from '../assets/exception-icons/maintenance.png'
import busyIcon from '../assets/exception-icons/busy.png'
import emptyIcon from '../assets/exception-icons/empty.png'
import timeoutIcon from '../assets/exception-icons/timeout.png'
import restrictedIcon from '../assets/exception-icons/restricted.png'
import { exceptionStates } from './exceptionStates'

const icons = Object.freeze({
  'not-found': notFoundIcon,
  network: networkIcon,
  forbidden: forbiddenIcon,
  maintenance: maintenanceIcon,
  busy: busyIcon,
  empty: emptyIcon,
  timeout: timeoutIcon,
  restricted: restrictedIcon,
})

const props = defineProps({
  type: { type: String, required: true },
  description: { type: String, default: '' },
  compact: Boolean,
  mobile: Boolean,
  showAction: { type: Boolean, default: true },
})
const emit = defineEmits(['action'])
const state = computed(() => exceptionStates[props.type] || exceptionStates.busy)
const icon = computed(() => icons[props.type] || icons.busy)
</script>

<template>
  <section class="exception-state" :class="{ 'is-compact': compact, 'is-mobile': mobile }" role="status" aria-live="polite">
    <span class="exception-art" aria-hidden="true"><img :src="icon" alt=""></span>
    <h2>{{ state.title }}</h2>
    <p>{{ description || state.description }}</p>
    <button v-if="showAction && state.action" type="button" @click="emit('action')">{{ state.action }}</button>
  </section>
</template>

<style scoped>
.exception-state{display:flex;min-height:100dvh;width:100%;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;background:#17191c;color:#e8eaed;text-align:center}
.exception-art{display:grid;width:80px;height:80px;flex:none;place-items:center}
.exception-art img{display:block;width:100%;height:100%;object-fit:contain;opacity:.448}
.exception-state h2{margin:16px 0 8px;font-size:14px;font-weight:650;line-height:1.35;opacity:.64}
.exception-state p{max-width:36ch;margin:0;color:#b7bdc6;font-size:12px;line-height:1.6;opacity:.64}
.exception-state button{min-height:44px;margin-top:26px;padding:0 24px;border:1px solid #bb984a;border-radius:4px;background:#353026;color:#dfc890;font:inherit;font-size:14px;cursor:pointer}
.exception-state button:hover{background:#433925}
.exception-state button:focus-visible{outline:2px solid #dfc890;outline-offset:3px}
.exception-state.is-mobile{min-height:0;flex:1;padding:24px 20px}
.exception-state.is-mobile h2{font-size:14px}
.exception-state.is-compact{min-height:180px;padding:20px 12px;background:transparent}
.exception-state.is-compact h2{margin:10px 0 3px;font-size:14px}
.exception-state.is-compact p{font-size:12px}
</style>
