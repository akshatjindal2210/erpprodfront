/**
 * Shortage PPC import — supports:
 * 1) Header row: item_dcode / item_code / qty
 * 2) Headerless: col A = item_dcode, B = item_code, C = qty
 */
function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

const DCODE_KEYS = new Set(["itemdcode", "itemcodeid", "dcode", "id"]);
const CODE_KEYS = new Set(["itemcode", "code", "item"]);
const QTY_KEYS = new Set(["qty", "quantity", "qtypcs", "pcs"]);

function isShortageHeaderRow(cells = []) {
  const norms = cells.map(normHeader).filter(Boolean);
  if (!norms.length) return false;
  const hitDcode = norms.some((h) => DCODE_KEYS.has(h) || h === "itemdcode");
  const hitCode = norms.some((h) => CODE_KEYS.has(h));
  const hitQty = norms.some((h) => QTY_KEYS.has(h));
  // Need at least qty + one identity column labeled as header (not a numeric dcode)
  if (!hitQty) return false;
  if (hitDcode || hitCode) return true;
  return false;
}

function mapHeaderIndexes(cells = []) {
  const idx = { dcode: -1, code: -1, qty: -1 };
  cells.forEach((cell, i) => {
    const h = normHeader(cell);
    if (!h) return;
    if (idx.dcode < 0 && (DCODE_KEYS.has(h) || h === "itemdcode")) idx.dcode = i;
    else if (idx.code < 0 && CODE_KEYS.has(h)) idx.code = i;
    else if (idx.qty < 0 && QTY_KEYS.has(h)) idx.qty = i;
  });
  return idx;
}

export function parseShortageImportMatrix(matrix = []) {
  const rows = (matrix || []).filter((row) =>
    Array.isArray(row) ? row.some((c) => String(c ?? "").trim() !== "") : false
  );
  if (!rows.length) return [];

  const first = rows[0] || [];
  const hasHeader = isShortageHeaderRow(first);
  const start = hasHeader ? 1 : 0;
  const cols = hasHeader
    ? mapHeaderIndexes(first)
    : { dcode: 0, code: 1, qty: 2 };

  // Headerless / partial header fallbacks
  if (cols.dcode < 0) cols.dcode = 0;
  if (cols.code < 0) cols.code = 1;
  if (cols.qty < 0) cols.qty = 2;

  const out = [];
  for (const row of rows.slice(start)) {
    const item_dcode = String(row[cols.dcode] ?? "").trim();
    const item_code = String(row[cols.code] ?? "").trim();
    const qty = String(row[cols.qty] ?? "").trim();
    if (!item_dcode && !item_code) continue;
    if (!qty) continue;
    out.push({ item_dcode, item_code, qty, type: "PPC" });
  }
  return out;
}
