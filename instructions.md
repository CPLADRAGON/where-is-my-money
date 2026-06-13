I want you to act as an expert financial data analyst and Excel/Google Sheets developer. I need you to generate a clean, automated, and easy-to-use Monthly Expense Tracker spreadsheet. 

Please provide the exact setup instructions and formulas (or Python/VBA code, if necessary) to create a spreadsheet with the following structure and functionality:

### 1. Sheet Structure
*   **Tab 1: 'Dashboard'** – A visual summary of my spending.
*   **Tab 2: 'Transactions'** – The raw data sheet where I will paste or type my bank transactions.
*   **Tab 3: 'Setup'** – A hidden or secondary sheet containing my budget targets and category definitions.

### 2. The "3-Bucket" Category System
I want to move away from messy, over-complicated bank categories. In the 'Setup' tab, please define these three major pillars and their sub-categories:
1. **Fixed Needs:** Accommodation/Rent, Transport, Insurance, Basic Groceries, Utilities.
2. **Variable Wants:** Dining Out/Cafes, Entertainment/Hobbies, Subscriptions, Shopping, Travel.
3. **Future Savings:** Emergency Fund, Investments, General Savings.

### 3. 'Transactions' Tab Requirements
Column headers should be:
*   **A: Date** (DD/MM/YYYY)
*   **B: Description** (The raw merchant text from the bank statement)
*   **C: Amount** (Spend values)
*   **D: Main Pillar** (Drop-down menu containing: Fixed Needs, Variable Wants, Future Savings)
*   **E: Sub-Category** (A dependent drop-down that changes based on what is selected in Column D)
*   **F: Notes** (Optional comments)

### 4. 'Dashboard' Tab Requirements
I want a clear, glanceable overview of my monthly cash flow. Please provide formulas (`SUMIF` or `SUMIFS`) to calculate:
*   **Total Monthly Income** (A single manual input cell)
*   **Total Spent** vs. **Remaining Balance**
*   **Pillar Breakdowns:** Total amount and actual percentage spent on Fixed Needs, Variable Wants, and Future Savings.
*   **Target Comparison:** Compare my actual spending percentages against a standard baseline target (e.g., 50% Needs, 30% Wants, 20% Savings) using conditional formatting (e.g., turns Red if I overspend my "Wants" target).

### What I need from you:
1. Step-by-step instructions on how to set up the data validation for the dependent drop-down menus in Columns D and E.
2. The exact formulas to copy into the Dashboard tab to pull data from the Transactions tab automatically.
3. [Optional] If you can generate a downloadable Excel file directly, or provide a Python script using `pandas` and `openpyxl` to generate this `.xlsx` file for me, please do so!