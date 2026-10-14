"use client";

/** Top banner for View mode — item code + description clearly visible. */
export default function ProcessItemHeader({
  label = "Item",
  itemCode = null,
  itemDesc = null,
  accent = "indigo",
}) {
  const code = itemCode != null && String(itemCode).trim() !== "" ? String(itemCode).trim() : "—";
  const desc = itemDesc != null && String(itemDesc).trim() !== "" ? String(itemDesc).trim() : null;
  const ring = accent === "emerald" ? "border-emerald-200 bg-emerald-50/80" : "border-indigo-200 bg-indigo-50/80";
  const codeCls = accent === "emerald" ? "text-emerald-900" : "text-indigo-900";
  const labelCls = accent === "emerald" ? "text-emerald-700" : "text-indigo-700";

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${ring}`}>
      <p className={`text-[9px] font-black uppercase tracking-wide ${labelCls}`}>{label}</p>
      <p className={`mt-0.5 text-[15px] font-black leading-tight ${codeCls}`}>{code}</p>
      {desc ? <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-600">{desc}</p> : null}
    </div>
  );
}
