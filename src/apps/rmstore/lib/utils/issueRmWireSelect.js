/** Shared RM wire dropdown logic — Issue Request + IPR Reassign (SP1 / Super Admin). */

export function buildRmOptions(mappedItems = [], mode = "mapped", allItems = []) {
  const mapped = Array.isArray(mappedItems) ? mappedItems : [];
  if (mode === "all") {
    const all = Array.isArray(allItems) ? allItems : [];
    return all.length ? all : mapped;
  }
  if (mode === "mapped") return mapped;
  return mapped.length ? [mapped[0]] : [];
}

export function mapErpRmItems(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      rm_item_dcode: r.id ?? r.itemdcode ?? r.item_dcode ?? null,
      rm_item_code: r.item_code ?? r.itemcode ?? "",
      rm_item_desc: r.itemdesc ?? r.item_desc ?? "",
    }))
    .filter((r) => r.rm_item_dcode != null || r.rm_item_code);
}

export function rmOptionKey(rm) {
  return String(rm?.rm_item_dcode ?? rm?.rm_item_code ?? "");
}

function rmToSelectRow(rm) {
  if (!rm) return null;
  return {
    id: rmOptionKey(rm),
    item_code: rm.rm_item_code || "",
    itemdesc: rm.rm_item_desc || "",
    sub: rm.rm_item_desc || "",
    _rm: rm,
  };
}

export function fetchRmWireOptions(rmOpts, params = {}, { mappedItems = [] } = {}) {
  const search = String(params.search || "").trim().toLowerCase();
  const mappedKeys = new Set((mappedItems || []).map((m) => rmOptionKey(m)));
  const mappedOrder = (mappedItems || []).map((m) => rmOptionKey(m));
  let rows = (rmOpts || []).map(rmToSelectRow).filter(Boolean);
  rows = rows.map((r) => ({
    ...r,
    _isMapped: mappedKeys.has(String(r.id)),
  }));
  if (search) {
    rows = rows.filter((r) =>
      [r.item_code, r.itemdesc, r.sub].some((v) => String(v || "").toLowerCase().includes(search))
    );
  }
  rows.sort((a, b) => {
    if (a._isMapped !== b._isMapped) return a._isMapped ? -1 : 1;
    if (a._isMapped && b._isMapped) {
      return mappedOrder.indexOf(String(a.id)) - mappedOrder.indexOf(String(b.id));
    }
    return 0;
  });
  return Promise.resolve({
    data: rows,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
  });
}

export function getRmWireById(rmOpts, id) {
  const rm = (rmOpts || []).find((r) => rmOptionKey(r) === String(id));
  return Promise.resolve(rmToSelectRow(rm));
}

export function rmListHasKey(list, key) {
  const k = String(key || "").trim();
  if (!k) return false;
  return (list || []).some((rm) => rmOptionKey(rm) === k);
}

const SUPER_ADMIN_ROW_RM_COLORS = [
  { rowBorder: "border-l-4 border-l-indigo-500", chip: "bg-indigo-50 text-indigo-900 border border-indigo-200", dot: "bg-indigo-500", soft: "#eef2ff", accent: "#6366f1" },
  { rowBorder: "border-l-4 border-l-emerald-500", chip: "bg-emerald-50 text-emerald-900 border border-emerald-200", dot: "bg-emerald-500", soft: "#ecfdf5", accent: "#10b981" },
  { rowBorder: "border-l-4 border-l-amber-500", chip: "bg-amber-50 text-amber-900 border border-amber-200", dot: "bg-amber-500", soft: "#fffbeb", accent: "#f59e0b" },
  { rowBorder: "border-l-4 border-l-violet-500", chip: "bg-violet-50 text-violet-900 border border-violet-200", dot: "bg-violet-500", soft: "#f5f3ff", accent: "#8b5cf6" },
  { rowBorder: "border-l-4 border-l-cyan-500", chip: "bg-cyan-50 text-cyan-900 border border-cyan-200", dot: "bg-cyan-500", soft: "#ecfeff", accent: "#06b6d4" },
];

export function getSuperAdminRowRmColor(idx) {
  return SUPER_ADMIN_ROW_RM_COLORS[Number(idx) % SUPER_ADMIN_ROW_RM_COLORS.length];
}

export function isRmMappedForItems(rm, mappedItems = []) {
  const key = rmOptionKey(rm);
  return (mappedItems || []).some((m) => rmOptionKey(m) === key);
}

export function pickDefaultRmWireKey(rmOpts, preferItemCode = "") {
  const opts = Array.isArray(rmOpts) ? rmOpts : [];
  if (!opts.length) return { key: "", code: "" };
  const prefer = String(preferItemCode || "").trim().toUpperCase();
  let hit = opts[0];
  if (prefer) {
    const found = opts.find((r) => String(r.rm_item_code || "").trim().toUpperCase() === prefer);
    if (found) hit = found;
  }
  return { key: rmOptionKey(hit), code: String(hit?.rm_item_code || "").trim() };
}
