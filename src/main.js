import { createApp } from 'vue'
import Vant from './plugins/vant'
import './style/mobile-theme.css'
import './views/mobile/mobile.css'
import App from './App.vue'

createApp(App).use(Vant).mount('#app')
