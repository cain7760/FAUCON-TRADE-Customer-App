import { provide, ref } from 'vue'

// 只影响本地演示提交；不修改真实系统时钟或标的交易日历。
export const tradingTimeErrorKey = 'faucon-demo-trading-time-error'
export const nonTradingTimeMessage = '当前非交易时间，不可进行操作。'
export function useTradingTime() {
  const tradingTimeMode = ref(null)
  const tradingTimeError = () => tradingTimeMode.value === 'non-trading' ? nonTradingTimeMessage : ''
  function setTradingTimeMode(mode) {
    if (['trading', 'non-trading'].includes(mode)) tradingTimeMode.value = mode
  }
  provide(tradingTimeErrorKey, tradingTimeError)
  return { tradingTimeMode, setTradingTimeMode, tradingTimeError }
}
