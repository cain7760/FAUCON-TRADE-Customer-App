import { Button, ConfigProvider, Field, Popup, Tab, Tabbar, TabbarItem, Tabs } from 'vant'
import 'vant/es/style/base.css'
import 'vant/es/tabbar/index.css'
import 'vant/es/tabbar-item/index.css'
import 'vant/es/badge/index.css'
import 'vant/es/button/style'
import 'vant/es/field/style'
import 'vant/es/popup/style'
import 'vant/es/toast/style'
import 'vant/es/tab/style'
import 'vant/es/tabs/style'

// 底栏仍使用已有 SVG 插槽；表单控件的图标依赖由组件样式入口提供。
// 后续新增控件时，在此入口补齐对应的组件和样式依赖。

// 只注册移动端当前使用的组件，不加载整库样式。
export default {
  install(app) {
    app.use(ConfigProvider).use(Tabbar).use(TabbarItem)
    app.use(Button).use(Field).use(Popup).use(Tab).use(Tabs)
  },
}
