import { parseMeituan } from "../src/lib/parsers/meituan";
const csv = `美团交易账单明细
共：16笔记录
【美团交易账单明细列表】
交易创建时间,交易成功时间,交易类型,订单标题,收/支,支付方式,订单金额,实付金额,交易单号,商家单号,备注
2026-08-13 17:17:10,2026-08-13 17:17:25,支付,袁记云饺-袁记云饺代金券,支出,美团月付,¥73.60,¥73.37,260813112007016700,1M7U2WY0NMA04386,/
2026-08-12 19:34:12,2026-08-12 19:34:20,支付,PHO THE ONE福万越南餐厅,支出,微信支付,¥72.00,¥71.95,260812112007016700,1M7RNHLNTA704386,/`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseMeituan(csv);
ok(rows.length === 2, "two rows");
ok(rows[0].source === "MEITUAN" && rows[0].currency === "CNY", "source+currency");
ok(rows[0].amount === 73.37, "amount = 实付金额 (not 订单金额)");
ok(rows[0].paymentMethod === "美团月付" && rows[0].tags.includes("bnpl"), "美团月付 -> bnpl");
ok(rows[0].counterparty === "袁记云饺", "counterparty from 订单标题 before dash");
ok(rows[1].counterparty === "PHO THE ONE福万越南餐厅", "no dash -> full title");
ok(rows[0].date === "2026-08-13", "date from 交易成功时间");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
