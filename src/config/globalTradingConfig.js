import { reactive } from 'vue'

// 后台管理系统下发全局交易配置时，调用 applyGlobalTradingConfig 即可覆盖默认值。
export const globalTradingConfig = reactive({
  largeOrderAmountCny: 8_000_000,
})

export function applyGlobalTradingConfig(config = {}) {
  const limit = Number(config.largeOrderAmountCny)
  if (Number.isFinite(limit) && limit > 0) globalTradingConfig.largeOrderAmountCny = limit
}
