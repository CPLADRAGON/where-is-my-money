import { parseAlipay } from "../src/lib/parsers/alipay";
import { bridgeToApp } from "../src/lib/parsers";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };

const csv = `支付宝交易记录明细查询
共2笔记录
----------------支付宝----------------
交易时间,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-08-24 21:55:05,深圳市小规模科技有限公司,szz@x,美团外卖订单,支出,105.79,花呗,交易成功,123,,
2026-08-24 06:07:22,余额宝,,余额宝-收益,不计收支,0.25,余额宝,交易成功,456,,`;

const rows = parseAlipay(csv);
const sf = { source: "ALIPAY" as const, bankId: "alipay", bankLabel: "Alipay", encoding: "gb18030", rows };
const out = bridgeToApp([sf]);

ok(out.transactions.length === 2, "expense + transfer both bridge to transactions");
const t = out.transactions[0];
ok(t.sub === "Dining Out/Cafes", "美团外卖 -> Dining Out/Cafes via extended rules");
ok(t.currency === "CNY" && t.nativeAmount === 105.79, "native currency + amount preserved");
ok(t.source === "ALIPAY" && t.paymentMethod === "花呗", "source + paymentMethod carried onto Transaction");
ok(t.tags?.includes("bnpl"), "花呗 -> bnpl tag on Transaction");
ok(out.transactions[1].pillar === "Transfer", "不计收支 -> Transfer transaction (excluded from spending)");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
