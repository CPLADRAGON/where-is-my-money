import { convert, toDisplay } from "../src/lib/currency";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS" : "FAIL") + " -", m); c ? pass++ : fail++; };
// Exact-integer rates keep the floating-point math exact for the assertions.
const rates = { CNY: 2, SGD: 1 };
ok(convert(100, "CNY", "SGD", rates) === 200, "convert CNY->SGD");
ok(convert(200, "SGD", "CNY", rates) === 100, "inverse via 1/rate");
ok(toDisplay({ amount: 100, currency: "CNY" }, rates, "SGD") === 200, "toDisplay converts");
ok(toDisplay({ amount: 8.4, currency: "SGD" }, rates, "SGD") === 8.4, "same currency passthrough");
ok(toDisplay({ amount: 55 }, rates, "SGD") === 55, "no currency defaults to SGD view");
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
