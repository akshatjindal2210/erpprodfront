/** Build DataTable headers from API row keys. */
function humanizeKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function defaultListCell(v) {
  if (v === 0) return <span className="text-[10px] text-slate-600 tabular-nums">0</span>;
  if (v == null || v === "") return <span className="text-[10px] text-slate-400">—</span>;
  return <span className="text-[10px] text-slate-600 tabular-nums">{String(v)}</span>;
}

export function buildAllFieldHeaders(rows, opts = {}) {
  const { priority = [], exclude = [], labels = {}, render = {}, fallback = [] } = opts;
  if (!rows?.length) return fallback;

  const keySet = new Set();
  rows.forEach((row) => {
    if (row && typeof row === "object") Object.keys(row).forEach((k) => keySet.add(k));
  });

  const ordered = [
    ...priority.filter((k) => keySet.has(k)),
    ...[...keySet].filter((k) => !priority.includes(k) && !exclude.includes(k)).sort(),
  ];

  return ordered.map((key) => [
    labels[key] || humanizeKey(key),
    key,
    render[key] || defaultListCell,
    { sortable: true, width: "110px" },
  ]);
}
