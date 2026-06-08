/**
 * Dummy bill numbers until bill-list API is available.
 */
export const DUMMY_BILL_OPTIONS = [
  { bill_no: "INV-24001" },
  { bill_no: "INV-24002" },
  { bill_no: "INV-24003" },
  { bill_no: "INV-24004" },
  { bill_no: "INV-24005" },
  { bill_no: "INV-24006" },
  { bill_no: "INV-24007" },
  { bill_no: "INV-24008" },
  { bill_no: "INV-24009" },
  { bill_no: "INV-24010" },
];

/** Keep first occurrence only — avoids duplicate React keys in multi-select tags. */
export function uniqueBillNos(billNos) {
  const seen = new Set();
  const out = [];
  for (const raw of billNos || []) {
    const billNo = String(raw ?? "").trim();
    if (!billNo || seen.has(billNo)) continue;
    seen.add(billNo);
    out.push(billNo);
  }
  return out;
}

/** Split stored bill_no string into individual bill numbers (deduped). */
export function parseSavedBillNos(raw) {
  if (raw == null || raw === "") return [];
  return uniqueBillNos(
    String(raw)
      .split(/,\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

/** Join selected bill numbers for save — e.g. INV-24001,INV-24002 (deduped). */
export function formatBillNosForSave(billNos) {
  const unique = uniqueBillNos(Array.isArray(billNos) ? billNos.map(String) : []);
  if (unique.length === 0) return null;
  return unique.join(",");
}

export async function fetchDummyBillOptions({ search = "", page = 1, limit = 50 } = {}) {
  const q = String(search || "").trim().toLowerCase();
  let filtered = DUMMY_BILL_OPTIONS;
  if (q) {
    filtered = DUMMY_BILL_OPTIONS.filter((row) =>
      row.bill_no.toLowerCase().includes(q)
    );
  }
  const seen = new Set();
  filtered = filtered.filter((row) => {
    if (seen.has(row.bill_no)) return false;
    seen.add(row.bill_no);
    return true;
  });
  const start = (Math.max(1, Number(page) || 1) - 1) * limit;
  return {
    data: filtered.slice(start, start + limit),
    total: filtered.length,
  };
}

export async function getDummyBillByNo(billNo) {
  const found = DUMMY_BILL_OPTIONS.find((row) => row.bill_no === String(billNo));
  if (found) return { data: found };
  const label = String(billNo ?? "").trim();
  if (label) return { data: { bill_no: label } };
  return { data: null };
}
