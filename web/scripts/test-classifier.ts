import { classifyFile } from "../src/lib/parsers/classifier";
const enc = new TextEncoder();
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const alipay = new TextEncoder().encode("支付宝交易记录明细查询\n交易时间,交易对方,对方账号,商品说明,收/支,金额\n");
const ocbc = enc.encode("Transaction History\nTransaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)\n");
const wechat = enc.encode("微信支付账单明细\n交易时间,交易类型,交易对方\n");
const meituan = enc.encode("美团交易账单明细列表\n交易创建时间,交易成功时间\n");
const src = (r: ReturnType<typeof classifyFile>) =>
  r.kind === "classified" ? r.source : "";
ok(src(classifyFile(alipay.buffer, "alipay.csv")) === "ALIPAY", "alipay detected");
ok(src(classifyFile(ocbc.buffer, "ocbc.csv")) === "OCBC", "ocbc detected");
ok(src(classifyFile(wechat.buffer, "wechat.csv")) === "WECHAT", "wechat detected");
ok(src(classifyFile(meituan.buffer, "meituan.csv")) === "MEITUAN", "meituan detected");
ok(classifyFile(new Uint8Array([0x00]).buffer, "junk.bin").kind === "unknown", "unknown -> junk.bin");
// Real Alipay has a 交易分类 column and the data header sits AFTER a long preamble.
const deepAlipay =
  "导出信息：\n姓名：X\n支付宝账户: x\n" +
  "特别提示：这是一段很长的提示文本\n".repeat(2000) +
  "交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注\n";
ok(src(classifyFile(new TextEncoder().encode(deepAlipay).buffer, "a.csv")) === "ALIPAY", "alipay deep-header + 交易分类 detected");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
