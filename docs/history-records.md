# 数据菜单：历史委托与历史成交

## 已确认范围

查询包含今天，默认近 30 天（今天向前 29 天）；未来日期不可选。历史委托按订单保留记录，历史成交按成交编号逐笔展示，部分成交的实际成交同样纳入，零成交排除。沿用现有表格字段、筛选语义与导出；新增日期范围。历史页只读，三端同步，不增加历史指令表。

当前数据为明确标识的跨日期演示样例；真实服务端归档、分页接口、权限及完整交易日历未接入。历史边界按 Asia/Shanghai 业务日期判断，不使用浏览器本地时区。服务接入时以接口返回的交易日期为准，不从订单状态推断成交明细。

## Direction contract

THESIS: 将日期和条件固定在表格上方，以完整查询结果为工作对象，不把历史查询做成行情或资产看板。

OWN-WORLD: PC 继承现有深色底、金色活动下划线、12px 表格、D-DIN 数字及红买绿卖；App 继承当前主题变量及可触控控件，不替换基线、focus 或 C 方案。

STORY: 选择历史委托或历史成交，设定日期与账户等条件，查询、排序、分页、导出所有匹配结果；只读数据无交易动作。

FIRST VIEWPORT: 两个同级 Tab，日期/标的/编号及常用筛选，当前查询范围与条数，剩余空间为独立滚动表格，底部分页。App 允许条件折叠，表格局部横向滚动。

FORM: 已由用户确认的双 Tab 表格结构；无需新视觉方向。seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 最终实现与验证记录

交易账户移入筛选条件，默认全部，支持按名称/编号搜索和多选。两张历史表各自保留账户等筛选的草稿与已应用条件、排序、分页及数据快照；查询或刷新才提交账户条件，重置恢复全部。PC 空间不足时收入现有「更多」，App 放入现有筛选弹层。日期按 Asia/Shanghai 判断，默认近 30 天含今天；CSV 导出全部匹配结果。成交按唯一成交编号逐笔展示，包含部分成交，且成交数量必须大于零。

### 2026-10-27 收盘撤单与手动同步

三端共用相同的收盘规则：A 股 15:00（上海），港股含 CAS 至 16:10（香港），美股常规盘 16:00（纽约，Intl 自动处理夏令时）。已配置 HKEX 2026-02-16、12-24、12-31 半日市 12:10 及 NYSE 2026-11-27、12-24 提前收盘 13:00。来源：[HKEX 交易时段](https://www.hkex.com.hk/Services/Trading-hours-and-Severe-Weather-Arrangements/Trading-Hours/Securities-Market?sc_lang=en)、[HKEX 2026 日历](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf)、[NYSE 交易时段与日历](https://www.nyse.com/trade/hours-calendars)。港股随机收市当前保守取结束上限；接口可通过带时区的 sessionCloseAt 返回实际收市瞬间，交易日可通过 tradingDate 指定。

非终态的未成交订单到期变为「撤单」，部分成交变为「部撤」；清零挂单与冻结保证金，保留成交数量/价格/金额，金额单撤回剩余预算并保留币种。全成、撤单、部撤、拒单终态不变，重复检查不会再次累计。指令状态机及子表不参与此规则。页面定时检查，重新聚焦/恢复可见/读取数据时补检查；浏览器关闭期间无后台执行能力，真实撤单必须由交易服务执行并以回报为准，完整交易日历及其他年份需服务端提供。

历史首次打开时捕获未筛选的订单和逐笔成交，以订单编号/成交编号去重。此后仅当前历史表的「查询」或「刷新」读取最新来源；切菜单、切 Tab、排序、翻页、列管理、导出及重置筛选都使用已捕获的快照。PC 与 App 均缓存历史页面，避免切菜单隐式重查。无效日期查询不刷新快照。往日演示委托遵循收盘终态，历史成交始终保留实际成交记录。

### 复用边界

三端的日内订单/成交及历史委托/成交均不再提供「订单类型」筛选，主筛选、更多面板与 App 筛选面板一致移除；兼容旧条件时也不按该字段过滤。表格与详情仍保留订单类型字段。PC 订单状态控件默认完整显示「订单状态」，空选择内容区保留 24px 高度以避免占位文字被裁切。

历史页实际复用 `src/views/mobile/equity/EquityFilters.vue`、`EquityRecordsTable.vue` 和 `EquityFocusTools.vue`。日期放在现有筛选弹层的订单编号后；打开及重置时复制日期数组，避免未查询条件污染已应用结果。历史表以 `readonly` 关闭行交易动作和详情导航，保持现有字段、排序、列配置及导出工具；每页 20 条，使用上一页 / 下一页。

当日订单仅在系统运行且记录为异常系统单时允许转手工；未扩展其他状态。订单数量/金额排序使用 `inputAmount ?? quantity` 数值，订单属性按 `row.type` 对应标签排序，三端语义一致。

### 验证范围与限制

本轮三端构建、相关回归与 `git diff --check` 均通过；最终复核中，各端 `historyModel.test.js` 均为 11/11 通过，组件复用由 `componentParity.test.js` 覆盖。已验证默认 CSV 下载为 180 条委托、120 条成交，成交编号唯一且数量均为正；App 重置、原生日期上限及日期在编号后的布局已检查。数字仅指本轮默认样例，不代表固定业务总量。

最终审查的 `disposition: ship` 限于两项排序修复的 verdict pass；两项均已解决，并复查三端共 7 张截图，不等同于真实接口、原生容器或全部终端验收。

文档复核对照了本仓库 `PRODUCT.md`、`DESIGN.md`、原方向合同、实际复用组件及 `.impeccable/review/history/app-history.png`、`app-filters-date.png`。既有 `DESIGN.md` 仅约束 focus；截图为当前基线，不能据此覆盖 focus 或概念 C。此次不修改既有设计文件、令牌或 sidecar。

预先存在的文档偏差：`PRODUCT.md` 将演示账户写为自营一号 / 二号两项，当前 `fixtures.js` 已有 `TZS_T0` 至 `TZS_T7` 共八项。本轮只记录该差异，不在历史功能任务中修订产品文档或账户数据。

90 天历史来源为明确标识的独立合成演示样例，真实归档接口、服务端分页、权限、持久化及完整交易日历尚未接入。本轮仅本地修改，无提交、推送或 Pages 发布，无新增产品交付 raster 素材。
