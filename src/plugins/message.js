import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import '../style/message.css'

// 全局消息浮在 App 可视区域中上部，不参与页面布局，也不创建蒙版。
export function showAppMessage(message, type = 'success') {
  const bounds = document.querySelector('.mobile-app')?.getBoundingClientRect()
  return ElMessage({
    message, type, duration: 2000, customClass: 'app-feedback-message',
    offset: Math.round(bounds ? bounds.top + bounds.height * .24 : window.innerHeight * .24),
  })
}
