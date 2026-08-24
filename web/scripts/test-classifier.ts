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
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
