// 下单检索演示数据：价格、持仓及每手股数仅供原型演示，不是实时行情。
export const hongKongDemoInstruments = [
  { code: '00700', name: '腾讯控股', price: 320 },
  { code: '09988', name: '阿里巴巴-W', price: 85 },
  { code: '03690', name: '美团-W', price: 118 },
  { code: '01810', name: '小米集团-W', price: 25 },
  { code: '00388', name: '香港交易所', price: 245 },
  { code: '00005', name: '汇丰控股', price: 68 },
].map(row => ({ ...row, id: `HK-${row.code}`, market: 'HK', currency: 'HKD', cost: row.price, change: 0, qty: 0, available: 0, lotSize: 100 }))
