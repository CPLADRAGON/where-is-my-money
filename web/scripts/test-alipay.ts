import { parseAlipay } from "../src/lib/parsers/alipay";
const csv = `---------------------
支付宝交易记录明细查询
支付宝账户：65-xxx
共107笔记录
支出：43笔 5339.84元
------------------------支付宝...------------------------
交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-08-24 21:55:05,深圳市小规模科技有限公司,szz***@bytedance.com,美团外卖订单,支出,105.79,花呗,交易成功,2026082423001403041435513033,,
2026-08-24 06:07:22,余额宝,,余额宝-收益,不计收支,0.25,余额宝,交易成功,20260824363327858041,,`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseAlipay(csv);
ok(rows.length === 2, "two data rows parsed");
ok(rows[0].source === "ALIPAY" && rows[0].currency === "CNY", "source+currency");
ok(rows[0].direction === "EXPENSE" && rows[0].amount === 105.79, "expense amount");
ok(rows[0].paymentMethod === "花呗" && rows[0].tags.includes("bnpl"), "花呗 -> bnpl tag");
ok(rows[0].rawCategory.includes("美团外卖"), "rawCategory = 商品说明");
ok(rows[0].counterparty.includes("深圳"), "counterparty = 交易对方");
ok(rows[0].date === "2026-08-24", "date ISO");
ok(rows[1].direction === "TRANSFER", "不计收支 -> TRANSFER");
// 支出 + 转账 -> personal transfer, not spending
const csv2 = `支付宝交易记录明细查询
共1笔记录
交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-08-01 12:00:00,包容,sz@x,转账,支出,2000,余额宝,交易成功,O1,,`;
const rows2 = parseAlipay(csv2);
ok(rows2[0].direction === "TRANSFER", "转账 -> TRANSFER (excluded from spending)");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
