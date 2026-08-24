import { parseWechatText, parseWechatXlsx } from "../src/lib/parsers/wechat";
import * as XLSX from "xlsx";
const csv = `微信支付账单明细
微信昵称：[CPLADRAGON]
----------------------微信支付
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-08-15 18:23:34,商户消费,OCTOBOX,Powered by NETS,支出,8.40,零钱,支付成功,42000032392026081501886424,N0260815182326520617,/
2026-08-13 16:58:02,转账,钇龙,转账备注:祝儿子旅途愉快,收入,1666,,已存入零钱,10000500012026081301283295,,`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseWechatText(csv);
ok(rows.length === 2, "two rows");
ok(rows[0].source === "WECHAT" && rows[0].currency === "CNY", "source+currency");
ok(rows[0].direction === "EXPENSE" && rows[0].amount === 8.4, "expense");
ok(rows[0].counterparty === "OCTOBOX", "counterparty");
ok(rows[0].paymentMethod === "零钱", "paymentMethod");
ok(rows[0].date === "2026-08-15", "date");
// .xlsx path
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["微信支付账单明细"], ["微信昵称：[X]"],
  ["----------------------微信支付", ""],
  ["交易时间", "交易类型", "交易对方", "商品", "收/支", "金额(元)", "支付方式", "当前状态", "交易单号", "商户单号", "备注"],
  ["2026-08-16 21:10:28", "微信红包", "Des Rosiers", "/", "收入", "1.01", "/", "已存入零钱", "10000398010136081670313317", "10000398012026081670313317", "/"],
]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
const xrows = parseWechatXlsx(buf);
ok(xrows.length === 1 && xrows[0].direction === "INCOME" && xrows[0].amount === 1.01, "xlsx parsed as income");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
