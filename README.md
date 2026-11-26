# Sales & Purchase Excel Combiner

A local app for combining one outlet sales Excel report and one outlet purchase Excel report into a single Excel table.

## Use

1. Start the app by double-clicking `run.bat`, or use `start_dev.bat` for development.
2. Select the sales Excel file and the purchase Excel file.
3. Choose **Find outlets** to load the branch list and totals.
4. Choose one of three view options:
   - **Show whole outlets**: item-level sales and purchase for all branches in the page.
   - **Show master summary**: one row per outlet with totals and item count in the page.
   - **Show this outlet**: item-level sales and purchase for the selected branch in the page.

The item-level results show one row per outlet and recipe item, with these columns:

- Outlet
- Recipe Item
- Sales Quantity
- Sales Amount
- Purchase Quantity
- Purchase Amount

Rows with matching outlet and recipe item names are combined and quantities/amounts are summed. If the purchase report has a quantity but no amount, the app estimates that row's purchase amount using the same outlet/item sales unit price and marks it as estimated. If there is no corresponding sales quantity and amount, the purchase amount remains unavailable. Outlet matching ignores case, spacing, punctuation, and outlet codes such as `OUT-012`; item matching ignores case and repeated whitespace.

The results appear directly in a searchable, paginated table on the page; no Excel download is required for viewing.
Outlet names and visible table rows can be searched. Large tables display 100 rows per page.

## Input files

Use `.xlsx`, `.xlsm`, legacy `.xls`, or `.csv` files. The app automatically looks for a report worksheet and supports outlet-wise matrix and flat tabular report formats, including `Outlet Name` and `Recipe Item Name` columns. The report must provide outlet and recipe item names; quantity and amount values are included when available. Legacy `.xls` reading uses the `xlrd` dependency installed from `requirements.txt`.

## Run locally

Double-click `run.bat` to start the local app. For development, run `start_dev.bat` to start the backend and frontend.
