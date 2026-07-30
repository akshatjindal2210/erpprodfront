# Excel Import & Export — Quick Guide

Simple reference for spreadsheet import/export in this app.

---

## Libraries

| Package | Where | Used for |
|---------|-------|----------|
| `read-excel-file` ^9.3.5 | Frontend + Backend | Read `.xlsx` / `.csv` |
| `write-excel-file` ^4.1.1 | Frontend only | Download `.xlsx` |

**Do not use:** `xlsx`, `@e965/xlsx`, `exceljs` (audit / complexity issues)

**Import paths (required):**
- Browser: `read-excel-file/browser`, `write-excel-file/browser`
- Backend: `read-excel-file/node`

**Frontend `package.json` overrides** — do not remove without running `npm audit`.

---

## Main files

| File | What it does |
|------|--------------|
| `frontend/src/platform/utils/list/tableExport.js` | Main export — CSV, Excel, PDF |
| `frontend/src/platform/utils/list/listPageExport.js` | List page export from table headers |
| `frontend/src/platform/hooks/list/useListPageExport.js` | Export hook for list pages |
| `frontend/src/platform/utils/list/dataTableCellSelection.js` | Cell text + Excel number values |
| `frontend/src/platform/utils/list/excelWorkbook.js` | Import preview in browser |
| `backend/src/apps/task/lib/shared/utils/excelSheet.js` | Import on server |

**Report-specific export files:**
- `ims/modules/inventory-report/inventoryReportExport.js`
- `rmstore/modules/inventory-report/inventoryReportExport.js`
- `ims/modules/erp-stock-report/erpStockReportExport.js`
- `ims/modules/audit/auditComparisonExport.js` (multi-sheet)
- `task/modules/cl-task/report/reportExcelExport.js` (row colors only)

**Import feature:** Holiday bulk upload  
- Frontend: `task/modules/holidays/BulkUpload.js`  
- Backend: `task/modules/holidays/controllers/holiday.controller.js`

---

## How export works

```
Export button
  → useListPageExport (most pages)
  → listPageExport / tableExport
  → write-excel-file (Excel only)
```

**Formats:** `csv` | `xlsx` | `pdf`  
(`excel` is also accepted — converted to `xlsx`)

---

## How import works

```
User picks file
  → Browser preview: excelWorkbook.js
  → Server save: excelSheet.js (Holiday upload)
```

**Supported:** `.xlsx`, `.csv`  
**Not supported:** `.xls` (old format)

---

## Excel number rules

Numbers must export as **numeric**, not text, so `SUM()` works in Excel.

Handled in `tableExport.js`:
- Numbers → `{ value: 27000, format: '#,##0' }` (shows 27,000 + SUM works)
- Dates → text `dd/mm/yyyy` (avoids library error)
- Text → plain string

**List pages** — add to header options:
```js
["Qty", "qty", renderFn, { exportType: "number" }]
```

**Custom reports** (`createModuleExporter`) — always pass `type`:
```js
{ label: "Qty", key: "qty", type: "number", format: (v) => ... }
```

> If `type: "number"` is missing, Excel gets text like `"27,000"` and SUM fails.

---

## Add export to a new list page

```js
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";

const { exporting, handleExport, exportDisabled } = useListPageExport({
  moduleName: "My Page",
  rows: filteredRows,  // all filtered rows, not just visible page
  headers,
});

<ListPageExportToggle exporting={exporting} disabled={exportDisabled} onExport={handleExport} />
```

---

## Add export to a custom report

Copy pattern from `inventoryReportExport.js`:

```js
export function buildMyExportColumns() {
  return COLUMNS.map(({ label, key, type }) => ({
    label,
    key,
    type,  // do not skip this
    format: (v) => formatCell(type, v),
  }));
}

export const exportMyReport = createModuleExporter({
  moduleName: "My Report",
  columns: buildMyExportColumns(),
});
```

**ERP Stock Report note:** Balance column is `type: "diff"` on screen but exports as `type: "number"`.  
Screen shows `+27,000` / `−5,000`. Excel shows `27,000` / `-5,000` (normal numeric).

---

## Where export is used

**Most list pages (40+)** — `useListPageExport`  
Task, IMS, RM Store modules (tasks, logs, inward, outward, masters, etc.)

**Custom reports** — `createModuleExporter`  
Inventory Report (IMS + RM), ERP Stock Report

**Special cases**
- Audit comparison → multi-sheet Excel
- CL Task Report → colored score cells
- Dashboard widgets → `WidgetRenderer.js`

---

## Common problems

| Problem | Fix |
|---------|-----|
| SUM not working in Excel | Add `type: "number"` or `{ exportType: "number" }` |
| Commas missing in Excel | Set `type: "number"` — formatting is in `tableExport.js` |
| Date export error | Already fixed — dates export as text |
| `.xls` upload fails | User must save as `.xlsx` or `.csv` |
| Module not found | Use `/browser` or `/node` import path |

---

## Before changing or removing libraries

1. Run `npm audit` in frontend and backend
2. Test Excel export → check commas + SUM
3. Test CSV and PDF export
4. Test holiday bulk upload
5. Commit `package.json` + `package-lock.json`

**If removed:**
- `write-excel-file` → all Excel export breaks
- `read-excel-file` (frontend) → holiday upload preview breaks
- `read-excel-file` (backend) → holiday bulk upload API breaks

**Keep in sync:** `excelWorkbook.js` (frontend) and `excelSheet.js` (backend) use same parsing logic.

---

## Limits

- `.xls` not supported
- Excel numbers use whole number format (`#,##0`) — no decimals by default
- PDF opens print dialog (user saves manually)
- Export runs in browser — large data must load in memory first
