<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ accounts: { type: Array, required: true }, selectedId: String })
defineEmits(['select'])
const search = ref(''), searchInput = ref(null)
const matches = computed(() => props.accounts.filter(account => `${account.id}${account.name}`.toLowerCase().includes(search.value.trim().toLowerCase())))
function clearSearch() { search.value = ''; searchInput.value?.focus() }
</script>

<template>
  <section class="ticket-account-picker" aria-label="下单账户选择">
    <form class="account-picker-search" role="search" @submit.prevent="searchInput?.blur()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input ref="searchInput" v-model="search" type="search" aria-label="搜索下单账户" placeholder="搜索账户名称 / 编号" autocomplete="off" spellcheck="false" enterkeyhint="search">
      <button v-if="search" type="button" aria-label="清空账户搜索" @click="clearSearch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
    </form>
    <div class="account-picker-list" role="group" aria-label="下单账户选项">
      <button v-for="account in matches" :key="account.id" type="button" class="account-picker-option" :aria-label="`${account.name} ${account.id}`" :aria-pressed="selectedId === account.id" @click="$emit('select', account.id)">
        <span class="account-picker-identity"><strong>{{ account.name }}</strong><span class="app-numeric">{{ account.id }}</span></span>
        <span class="account-picker-check" aria-hidden="true"><svg v-if="selectedId === account.id" viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></span>
      </button>
      <div v-if="!matches.length" class="account-picker-empty" role="status"><strong>未找到匹配账户</strong><span>试试账户名称或编号</span></div>
    </div>
  </section>
</template>

<style scoped>
.ticket-account-picker { display: flex; min-height: 0; flex-direction: column; padding: 8px 16px max(20px, env(safe-area-inset-bottom)); }
.account-picker-search { display: flex; min-height: 44px; flex-shrink: 0; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--app-color-frame); border-radius: 3px; background: var(--app-color-control); }
.account-picker-search:focus-within { border-color: var(--app-color-accent); }
.account-picker-search > svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--app-color-text-secondary); }
.account-picker-search input { width: 0; min-width: 0; min-height: 42px; flex: 1; padding: 0; border: 0; background: transparent; font-size: 14px; }
.account-picker-search input:focus-visible { outline: none; }
.account-picker-search input::-webkit-search-cancel-button { appearance: none; }
.account-picker-search button { display: flex; width: 32px; height: 36px; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: var(--app-color-text-secondary); }
.account-picker-search button svg { width: 16px; height: 16px; }
.account-picker-search svg, .account-picker-check svg { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.account-picker-list { min-height: 0; max-height: 300px; margin-top: 12px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--app-color-frame) transparent; }
.account-picker-option { display: flex; width: 100%; min-height: 64px; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; border: 0; border-bottom: 1px solid var(--app-color-border); background: transparent; color: var(--app-color-text); text-align: left; }
.account-picker-option:last-of-type { border-bottom: 0; }
.account-picker-identity { display: grid; min-width: 0; gap: 5px; overflow-wrap: anywhere; }
.account-picker-identity strong { font-size: 15px; font-weight: 500; line-height: 20px; }
.account-picker-identity > span { color: var(--app-color-text-secondary); font-size: 12px; line-height: 16px; }
.account-picker-option[aria-pressed="true"] strong { color: var(--app-color-accent); }
.account-picker-check { display: flex; width: 20px; height: 20px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--app-color-text-secondary); border-radius: 50%; }
.account-picker-option[aria-pressed="true"] .account-picker-check { border-color: var(--app-color-accent); background: var(--app-color-accent); color: var(--app-color-background); }
.account-picker-check svg { width: 14px; height: 14px; stroke-width: 2; }
.account-picker-option:hover { background: var(--app-color-control); }
.account-picker-empty { display: flex; min-height: 128px; align-items: center; justify-content: center; flex-direction: column; gap: 8px; color: var(--app-color-text-secondary); }
.account-picker-empty strong { color: var(--app-color-text); font-size: 14px; font-weight: 400; }
.account-picker-empty span { font-size: 12px; }
</style>
