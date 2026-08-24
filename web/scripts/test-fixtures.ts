import { parseBatch, bridgeToApp } from "../src/lib/parsers";
import { mergeTransactions } from "../src/lib/merge";
import { isSpending } from "../src/lib/taxonomy";
import {
  ALIPAY_FIXTURE,
  WECHAT_CSV_FIXTURE,
  MEITUAN_FIXTURE,
  OCBC_FIXTURE,
  OCBC_REPAY_FIXTURE,
} from "./fixtures";
import type { SourceFileResult } from "../src/lib/parsers/types";

const enc = new TextEncoder();
const batch = (csv: string, name: string): SourceFileResult =>
  parseBatch([{ bytes: enc.encode(csv).buffer, name }]).files[0];

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };

// --- Per-source detection + parsing ---
const alipay = batch(ALIPAY_FIXTURE, "alipay.csv");
ok(alipay.source === "ALIPAY" && alipay.rows.length === 2, "alipay fixture -> 2 rows (1 spend, 1 transfer)");
ok(alipay.rows[0].tags.includes("bnpl"), "alipay 花呗 purchase tagged bnpl");

const meituan = batch(MEITUAN_FIXTURE, "meituan.csv");
ok(meituan.source === "MEITUAN" && meituan.rows[0].amount === 73.37, "meituan uses 实付金额");
ok(meituan.rows[0].tags.includes("bnpl"), "meituan 美团月付 tagged bnpl");

const wechat = batch(WECHAT_CSV_FIXTURE, "wechat.csv");
ok(wechat.source === "WECHAT" && wechat.rows.length === 2, "wechat csv -> 2 rows");
ok(wechat.rows[0].direction === "EXPENSE", "wechat expense direction");

const ocbc = batch(OCBC_FIXTURE, "ocbc.csv");
ok(ocbc.source === "OCBC", "ocbc detected");

// --- Anti-double-counting: Alipay 花呗 purchase vs OCBC repayment ---
const a = bridgeToApp([batch(ALIPAY_FIXTURE, "alipay.csv")]);
const o = bridgeToApp([batch(OCBC_REPAY_FIXTURE, "ocbc.csv")]);
const merged = mergeTransactions(o.transactions, a.transactions);
ok(merged.find((t) => t.counterparty === "MEITUAN")?.pillar === "Transfer", "repayment -> Transfer on merge");
const spent = merged.filter((t) => isSpending(t.pillar)).reduce((s, t) => s + t.amount, 0);
ok(Math.round(spent * 100) / 100 === 105.79, `spending counted once, no double-count (got ${spent})`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
