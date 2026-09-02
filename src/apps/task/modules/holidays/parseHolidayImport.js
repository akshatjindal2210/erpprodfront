/**
 * Holiday bulk import — supports:
 * 1) Header row: name / holiday_name + date
 * 2) Headerless: col A = name, col B = date (YYYY-MM-DD or DD/MM/YYYY)
 */
function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

const NAME_KEYS = new Set(["name", "holidayname", "holiday", "title"]);
const DATE_KEYS = new Set(["date", "holidaydate"]);

function isHolidayHeaderRow(cells = []) {
  const norms = cells.map(normHeader).filter(Boolean);
  if (!norms.length) return false;
  const hitName = norms.some((h) => NAME_KEYS.has(h));
  const hitDate = norms.some((h) => DATE_KEYS.has(h));
  return hitName && hitDate;
}

function mapHeaderIndexes(cells = []) {
  const idx = { name: -1, date: -1 };
  cells.forEach((cell, i) => {
    const h = normHeader(cell);
    if (!h) return;
    if (idx.name < 0 && NAME_KEYS.has(h)) idx.name = i;
    else if (idx.date < 0 && DATE_KEYS.has(h)) idx.date = i;
  });
  return idx;
}

/** Normalize to YYYY-MM-DD — main gate for import rows. */
export function normalizeHolidayDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return !Number.isNaN(Date.parse(s)) ? s : null;
  }

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = String(parseInt(dmy[1], 10)).padStart(2, "0");
    const month = String(parseInt(dmy[2], 10)).padStart(2, "0");
    const year = dmy[3];
    const iso = `${year}-${month}-${day}`;
    return !Number.isNaN(Date.parse(iso)) ? iso : null;
  }

  return null;
}

export function parseHolidayImportMatrix(matrix = []) {
  const rows = (matrix || []).filter((row) =>
    Array.isArray(row) ? row.some((c) => String(c ?? "").trim() !== "") : false
  );
  if (!rows.length) return [];

  const first = rows[0] || [];
  const hasHeader = isHolidayHeaderRow(first);
  const start = hasHeader ? 1 : 0;
  const cols = hasHeader ? mapHeaderIndexes(first) : { name: 0, date: 1 };

  if (cols.name < 0) cols.name = 0;
  if (cols.date < 0) cols.date = 1;

  const out = [];
  for (const row of rows.slice(start)) {
    const name = String(row[cols.name] ?? "").trim();
    const date = normalizeHolidayDate(row[cols.date]);
    if (!name || !date) continue;
    out.push({ name, date });
  }
  return out;
}
