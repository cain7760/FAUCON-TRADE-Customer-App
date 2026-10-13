# FAUCON TRADE Customer Mobile

Customer 端移动 Web 演示项目，独立于 PC Customer 与 Trader 项目发布。

## 当前范围

- 首页：资产概览、指数、自选行情和待处理订单。
- 交易：标的切换、限价/市价、买入/卖出、备注及提交确认。
- 订单：状态筛选、订单详情，以及未终态订单的改单、撤单演示。
- 资产：资金摘要与持仓。
- 我的：客户账户与基础入口。

当前使用模拟数据；不包含真实交易接口、认证、推送、风控或原生容器能力。

## 本地运行

```bash
npm ci
npm run dev
```

运行 `npm run build` 生成 GitHub Pages 所需的静态构建产物。
