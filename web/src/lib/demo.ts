/** A small embedded OCBC-format CSV so users can try the app without a file. */
export const DEMO_CSV = `Account details for:,OCBC FRANK Account 525-000000-001
Available Balance,"4,210.55"
Ledger Balance,"4,210.55"

Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
02/04/2026,02/04/2026,"IBG GIRO
30224037426 ACME TECHNOLOG SALA",,3000.00
05/04/2026,05/04/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/04/2026,07/04/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SINGTEL TELECOM",15.00,
10/04/2026,10/04/2026,"FAST PAYMENT
OTHR via PayNow-UEN to FOODPANDA SG",22.40,
12/04/2026,12/04/2026,"DEBIT PURCHASE
xx-1767 BUS/MRT 861001234        S                   11/04/26",2.10,
15/04/2026,15/04/2026,"DEBIT PURCHASE
xx-1767 SHENG SIONG SUPERMARKET   S                   14/04/26",33.20,
20/04/2026,20/04/2026,"FAST PAYMENT
OTHR via PayNow-Mobile to JOHN TAN",25.00,
02/05/2026,02/05/2026,"IBG GIRO
30224037526 ACME TECHNOLOG SALA",,3000.00
05/05/2026,05/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/05/2026,07/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SINGTEL TELECOM",15.00,
09/05/2026,09/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to FOODPANDA SG",18.90,
11/05/2026,11/05/2026,"DEBIT PURCHASE
xx-1767 UNIQLO -ION ORCHARD      S                   10/05/26",59.90,
14/05/2026,14/05/2026,"DEBIT PURCHASE
xx-1767 GOLDEN VILLAGE -VIVOCITY S                   13/05/26",13.50,
18/05/2026,18/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to STARBUCKS COFFEE",7.40,
02/06/2026,02/06/2026,"IBG GIRO
30224037626 ACME TECHNOLOG SALA",,3000.00
05/06/2026,05/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/06/2026,07/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SINGTEL TELECOM",15.00,
09/06/2026,09/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to FOODPANDA SG",25.30,
11/06/2026,11/06/2026,"DEBIT PURCHASE
xx-1767 SHOPEE SINGAPORE         S                   10/06/26",45.00,
13/06/2026,13/06/2026,"FAST PAYMENT
OTHR via PayNow-Mobile to MARY LIM",60.00,
15/06/2026,15/06/2026,"DEBIT PURCHASE
xx-1767 NTUC FP-CLEMENTI         S                   14/06/26",41.10,
`;

export interface BankGuide {
  bank: string;
  steps: string[];
}

/** Per-bank instructions for downloading a CSV statement. */
export const BANK_GUIDES: BankGuide[] = [
  {
    bank: "OCBC",
    steps: [
      "Log in to OCBC Internet Banking (or the mobile app).",
      "Go to your account → Transaction History / Account Activity.",
      "Choose a date range (e.g. the last 6 months).",
      "Click Download / Export and pick CSV format.",
    ],
  },
  {
    bank: "DBS / POSB",
    steps: [
      "Log in to digibank online.",
      "Open the account, then View Transaction History.",
      "Select your date range.",
      "Use Download → CSV.",
    ],
  },
  {
    bank: "UOB",
    steps: [
      "Log in to UOB Personal Internet Banking.",
      "Go to Account Summary → Transaction History.",
      "Pick the period you want.",
      "Export the statement as CSV.",
    ],
  },
  {
    bank: "Other banks",
    steps: [
      "Most banks offer a CSV/Excel export under Transaction History or Statements.",
      "Download the CSV, then use the column-mapping step if it isn't auto-detected.",
    ],
  },
];
