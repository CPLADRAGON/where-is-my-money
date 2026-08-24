import { decodeBytes, sniffEncoding } from "../src/lib/parsers/encoding";
const enc = new TextEncoder();
const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode("美团")]);
// two bytes that are NOT valid UTF-8 -> must fall back to gb18030
const gbk = new Uint8Array([0xc3, 0xc0, 0xcd, 0xcd]);
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
ok(sniffEncoding(bom) === "utf-8", "UTF-8 BOM detected");
ok(sniffEncoding(new Uint8Array([0xff, 0xfe])) === "utf-16", "UTF-16 BOM detected");
ok(sniffEncoding(gbk) === "gb18030", "invalid-UTF-8 falls back to gb18030");
const d = decodeBytes(bom.buffer);
ok(d.encoding === "utf-8", "decode returns utf-8");
ok(d.text.includes("美团"), "BOM stripped, text decoded");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
