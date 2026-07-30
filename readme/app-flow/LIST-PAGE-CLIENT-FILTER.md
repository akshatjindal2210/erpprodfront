# List Page — Client-Side Filter Guide

How to add **frontend (client-side) filters** on RM Store / IMS / Task list pages with the correct **indigo (quick)** vs **white (server)** styling.

---

## Quick reference

| Filter kind | Color | Styling variant |
|-------------|-------|-----------------|
| Search on loaded rows | Indigo | `searchVariant="quick"` |
| Dropdown on loaded rows | Indigo | `applyExtrasOnChange` + `searchVariant="quick"`, or `instantClientExtras`, or `variant: "quick"` on the filter |
| Date range (API refetch) | White | Always server when `showDate` is true |
| Dropdown sent to API | White | Default, or `variant: "server"` |

**Rule of thumb:** If changing the filter does **not** call the API again, it should look **indigo**. If it **does** refetch from the server, it should look **white**.

---

## Files involved

| File | Role |
|------|------|
| `frontend/src/ui/common/date/DateRangeFilter.js` | Filter strip UI, instant apply, color variant resolution |
| `frontend/src/ui/common/list/ListPageSearchField.js` | Indigo vs white CSS classes (`listPageFilterBoxClass`) |
| `frontend/src/ui/common/list/clientListSearch.js` | `applyClientSearch`, `sortRowsByKey`, `fetchAllListPages` |
| `frontend/src/apps/rmstore/lib/helpers/RmStoreListFooter.js` | Footer counts (`rmStoreFooterFromClientFilter`) |
| Page `Page.js` / `*Panel.js` | `allRows`, `filteredRows`, `DateRangeFilter` props |

---

## Data flow

```
API fetch  →  allRows  →  useMemo (client filters)  →  filteredRows  →  DataTable
                ↑                                              ↓
         only server params                          footer counts / export
         (e.g. date range)
```

1. Store the full list in `allRows` after fetch.
2. Derive `filteredRows` in `useMemo` (dropdown + search + sort).
3. Pass `filteredRows` (sliced) to `DataTable`.
4. Do **not** send client-only filter values to the API.

---

## Pattern A — Pure client (no date)

**Use when:** Search + one or more dropdowns; no date range, or date is not needed.

**Examples in repo:** RM Rejection → Pending tab (`rm-rejection/Page.js`).

### DateRangeFilter props

```jsx
<DateRangeFilter
  showDate={false}
  instantClientExtras
  showSearchButton={false}
  applyOnSearchEnter={false}
  searchVariant="quick"
  extraFilters={extraFilters}
  searchValue={tempSearch}
  onSearchChange={setTempSearch}
  onApply={(data) => {
    setParams((p) => ({ ...p, status: data.approvedStatus || "all" }));
  }}
  onReset={() => {
    setTempSearch("");
    setParams({ status: "all", sortKey: "uid", sortDir: "desc" });
  }}
/>
```

### Page state

```jsx
const [allRows, setAllRows] = useState([]);
const [tempSearch, setTempSearch] = useState(""); // direct state — no useAppliedListSearch

const filteredRows = useMemo(() => {
  let data = allRows;
  if (params.status !== "all") {
    data = data.filter((row) => row.approved === (params.status === "approved"));
  }
  if (tempSearch.trim()) {
    data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
  }
  return sortRowsByKey(data, params.sortKey, params.sortDir);
}, [allRows, params.status, tempSearch, params.sortKey, params.sortDir]);
```

---

## Pattern B — Hybrid (date = server, rest = client)

**Use when:** Date range refetches from API; status / type / search filter loaded rows only.

**Examples in repo:** In-Process Request (`in-process-request/InProcessRequestPanel.js`).

### DateRangeFilter props

```jsx
<DateRangeFilter
  showDate
  applyExtrasOnChange
  showSearchButton={false}
  applyOnSearchEnter={false}
  searchVariant="quick"
  fromDate={params.fromDate}
  toDate={params.toDate}
  extraFilters={extraFilters}
  searchValue={tempSearch}
  onSearchChange={setTempSearch}
  onApply={(data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
      requestType: data.requestType || prev.requestType,
    }));
  }}
/>
```

### Fetch — server params only

```jsx
const fetchRows = useCallback(async () => {
  const body = {
    filters: {
      ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
      ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
    },
  };
  const { data } = await fetchAllListPages(
    (page, limit) => inProcessRequestService.getAll({ ...body, page, limit }),
    500
  );
  setAllRows(data);
}, [params.fromDate, params.toDate]); // NOT status / requestType / search
```

### Client filter in useMemo

```jsx
const filteredRows = useMemo(() => {
  let data = allRows;
  if (params.requestType !== "all") {
    data = data.filter((r) => r.request_type === params.requestType);
  }
  if (params.status !== "all") {
    data = data.filter((r) => r.approved === (params.status === "approved"));
  }
  if (tempSearch.trim()) {
    data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
  }
  return sortRowsByKey(data, params.sortKey, params.sortDir);
}, [allRows, params.requestType, params.status, tempSearch, params.sortKey, params.sortDir]);
```

**Color result:** Date pickers = white. Search + dropdowns = indigo.

---

## Pattern C — Mixed (some server, some client)

**Use when:** e.g. status goes to API, search is client-only.

**Example in repo:** Issue Request (`issue-request/Page.js`).

- `searchVariant="quick"` + `applyOnSearchEnter={false}` → search box indigo, filters as you type.
- Status stays in `fetchRows` deps → dropdown stays **white** unless you add `applyExtrasOnChange` and move status filtering into `useMemo`.

To make **all** extras indigo on a dated page, use Pattern B (`applyExtrasOnChange` + remove that filter from the API).

---

## Extra dropdown config

```jsx
const extraFilters = useMemo(
  () => [
    {
      label: "Status",
      key: "approvedStatus", // onApply receives data.approvedStatus
      value: params.status,
      options: [
        { label: "All Status", value: "all" },
        { label: "Approved", value: "approved" },
        { label: "Pending", value: "pending" },
      ],
      // Optional — force color per filter:
      // variant: "quick",  // always indigo
      // variant: "server", // always white
    },
  ],
  [params.status]
);
```

`key` must match the property name used in `onApply` (`data[key]`).

For searchable dropdowns, `DateRangeFilter` uses `SearchableSelect` with the same variant rules.

---

## How color is resolved (`DateRangeFilter`)

```text
resolveExtraFilterVariant(filter):
  1. filter.variant === "quick" | "server"  → use it
  2. instantClientExtras && !showDate       → quick (indigo)
  3. applyExtrasOnChange && searchVariant="quick" → quick (indigo)
  4. else                                   → server (white)
```

Search field color: `searchVariant="quick"` → indigo input; `"server"` → white.

---

## Footer counts

Use `RmStoreListFooter` + `rmStoreFooterFromClientFilter` so filtered lists show correct copy:

- Normal: `Showing X of Y Entries`
- Client narrowed: `Showing X of Y Entries · Filtered From N`
- Zero matches: `0 Entries Match · N Total`

```jsx
const footerFilter = useMemo(
  () =>
    rmStoreFooterFromClientFilter({
      tempSearch,
      sourceRows: allRows,
      filteredRows,
      serverFiltered: Boolean(params.fromDate) || Boolean(params.toDate),
    }),
  [tempSearch, allRows, filteredRows, params.fromDate, params.toDate]
);

<RmStoreListFooter
  shown={items.length}
  total={filteredRows.length}
  label="Entries"
  isFiltered={footerFilter.isFiltered}
  databaseTotal={footerFilter.databaseTotal}
/>
```

`filteredLen !== sourceLen` (e.g. status dropdown) is detected automatically — you do not need to pass dropdown state separately.

---

## Complete minimal template (one dropdown + search)

```jsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DataTable from "@/ui/primitives/DataTable";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { myService } from "@/apps/rmstore/lib/services/myService";

const STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
];

export default function MyListPage() {
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({ status: "all", sortKey: "uid", sortDir: "desc" });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await myService.getAll({ page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, 500);
      setAllRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (params.status !== "all") {
      data = data.filter((row) => row.approved === (params.status === "approved"));
    }
    if (tempSearch.trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, params.status, tempSearch, params.sortKey, params.sortDir]);

  const items = filteredRows.slice(0, 100);

  const footerFilter = useMemo(
    () => rmStoreFooterFromClientFilter({ tempSearch, sourceRows: allRows, filteredRows }),
    [tempSearch, allRows, filteredRows]
  );

  const extraFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: STATUS_OPTIONS,
      },
    ],
    [params.status]
  );

  return (
    <>
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          instantClientExtras
          showSearchButton={false}
          applyOnSearchEnter={false}
          searchVariant="quick"
          extraFilters={extraFilters}
          searchValue={tempSearch}
          onSearchChange={setTempSearch}
          searchPlaceholder="Search..."
          searchLabel="Search"
          onApply={(data) => setParams((p) => ({ ...p, status: data.approvedStatus || "all" }))}
          onReset={() => {
            setTempSearch("");
            setParams({ status: "all", sortKey: "uid", sortDir: "desc" });
          }}
        />
      </ListPageFilterStrip>

      <DataTable data={items} loading={loading} />

      <RmStoreListFooter
        shown={items.length}
        total={filteredRows.length}
        label="Entries"
        isFiltered={footerFilter.isFiltered}
        databaseTotal={footerFilter.databaseTotal}
      />
    </>
  );
}
```

---

## Checklist (new client filter)

| Step | Action |
|------|--------|
| 1 | Add `allRows` state; fetch full list (or full date range) into it |
| 2 | Add `filteredRows` in `useMemo` with your filter logic |
| 3 | Pass `filteredRows` (sliced) to `DataTable` and export |
| 4 | Use `tempSearch` + `setTempSearch` for search (avoid `useAppliedListSearch` unless hybrid server search) |
| 5 | Set `searchVariant="quick"` on `DateRangeFilter` |
| 6 | Set `instantClientExtras` (no date) **or** `applyExtrasOnChange` (with date) |
| 7 | Set `showSearchButton={false}` and `applyOnSearchEnter={false}` |
| 8 | Remove client-only filter params from API `fetchRows` dependencies |
| 9 | Wire `RmStoreListFooter` with `rmStoreFooterFromClientFilter` |

---

## RM Store reference pages

| Page | Pattern | Notes |
|------|---------|-------|
| `modules/in-process-request/InProcessRequestPanel.js` | B — Hybrid | Date server; Type, Status, Search client |
| `modules/rm-rejection/Page.js` (Pending tab) | A — Pure client | `instantClientExtras`, no date |
| `modules/rm-rejection/Page.js` (Register tab) | B — Hybrid | Date + status server-ish; search client |
| `modules/issue-request/Page.js` | C — Mixed | Status API; search client |
| `modules/qc-check/Page.js` | A / B | Tab-dependent `instantClientExtras` |

---

## Common mistakes

1. **Double filtering** — Sending `status` / `search` to API **and** filtering in `useMemo`. Pick one layer per filter.
2. **White dropdown on client filter** — Missing `applyExtrasOnChange` or `instantClientExtras` when filters are client-only.
3. **Search button still visible** — Forgot `showSearchButton={false}` on pure client pages.
4. **Footer shows wrong total** — Passing `allRows.length` as `total` instead of `filteredRows.length`.
5. **Large date ranges** — Client filtering loads all rows in range first; very wide ranges may feel slow (trade-off by design).

---

## Related docs

- `frontend/readme/app-flow/CREATE-NEW-APP.md` — list page shell (`ListPageFilterStrip` + `DateRangeFilter`)
- `frontend/readme/version-notes/v2.3.28.task.md` — indigo client vs white server filter styling notes
