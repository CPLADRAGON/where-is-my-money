/** A small embedded OCBC-format CSV so users can try the app without a file. */
export const DEMO_CSV = `Account details for:,OCBC FRANK Account 525-000000-001
Available Balance,"4,210.55"
Ledger Balance,"4,210.55"

Transaction History
Transaction date,Value date,Description,Withdrawals(SGD),Deposits(SGD)
03/05/2026,03/05/2026,"IBG GIRO
30224037526 ACME TECHNOLOG SALA",,3000.00
03/05/2026,03/05/2026,"DEBIT PURCHASE
xx-1767 BUS/MRT 868005938        S                   02/05/26",2.21,
04/05/2026,04/05/2026,"DEBIT PURCHASE
xx-1767 SHENG SIONG SUPERMARKET   S                   03/05/26",38.65,
05/05/2026,05/05/2026,"FAST PAYMENT
OTHR-201618833 via PayNow-UEN to STARBUCKS COFFEE",7.40,
06/05/2026,06/05/2026,"FAST PAYMENT
OTHR via PayNow-UEN to NETFLIX SubSCRIPTION",19.98,
08/05/2026,08/05/2026,"DEBIT PURCHASE
xx-1767 UNIQLO -ION ORCHARD      S                   07/05/26",59.90,
10/05/2026,10/05/2026,"FAST PAYMENT
OTHR via PayNow-Mobile to JOHN TAN",25.00,
12/05/2026,12/05/2026,"BILL PAYMENT     INB
SP SERVICES LTD",84.30,
15/05/2026,15/05/2026,"DEBIT PURCHASE
xx-1767 GOLDEN VILLAGE -VIVOCITY S                   14/05/26",13.50,
02/06/2026,02/06/2026,"IBG GIRO
30224037626 ACME TECHNOLOG SALA",,3000.00
03/06/2026,03/06/2026,"DEBIT PURCHASE
xx-1767 BUS/MRT 868105938        S                   02/06/26",2.30,
04/06/2026,04/06/2026,"DEBIT PURCHASE
xx-1767 NTUC FP-CLEMENTI         S                   03/06/26",41.10,
06/06/2026,06/06/2026,"FAST PAYMENT
OTHR via PayNow-UEN to SPOTIFY AB",10.98,
07/06/2026,07/06/2026,"FAST PAYMENT
OTHR via PayNow-Mobile to MARY LIM",60.00,
09/06/2026,09/06/2026,"DEBIT PURCHASE
xx-1767 FOODPANDA -SINGAPORE     S                   08/06/26",22.40,
11/06/2026,11/06/2026,"DEBIT PURCHASE
xx-1767 SHOPEE SINGAPORE         S                   10/06/26",45.00,
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
