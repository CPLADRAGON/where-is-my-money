import { parseOcbc } from "../src/lib/parsers/ocbc";
const csv = `Account details for: TEST
Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
12/08/2026,12/08/2026,DEBIT PURCHASE  xx-1767 BK BURGER 313446,8.40,
12/08/2026,13/08/2026,GIRO - SALARY INFINEON,,3200.00
15/08/2026,15/08/2026,FAST PAYMENT to JACK SMITH,50.00,`;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
const rows = parseOcbc(csv);
ok(rows[0].source === "OCBC" && rows[0].currency === "SGD", "source+currency");
ok(rows[0].direction === "EXPENSE" && rows[0].amount === 8.4, "withdrawal -> expense");
ok(rows[0].paymentMethod === "OCBC Debit", "paymentMethod");
ok(rows[0].date === "2026-08-12", "DD/MM/YYYY -> ISO");
ok(rows[1].direction === "INCOME" && rows[1].amount === 3200, "deposit -> income");
ok(rows[2].direction === "TRANSFER", "FAST PAYMENT to person -> transfer");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
