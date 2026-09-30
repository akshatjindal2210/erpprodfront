/**
 * IMS-style bill status colors (same idea as Forwarding Note).
 * Saved DB bill → blue. Live invfnote status → green/yellow/red/…
 */

export function formatExternalBillStatus(status) {
  const raw = String(status ?? "").trim();
  const key = raw.toLowerCase();
  if (!raw) {
    return {
      text: "-",
      className: "bg-slate-50 text-slate-400 border-slate-100",
      textClass: "text-slate-400",
    };
  }

  const palette = {
    green: { badge: "bg-emerald-50 text-emerald-600 border-emerald-100", text: "text-emerald-600" },
    yellow: { badge: "bg-amber-50 text-amber-700 border-amber-100", text: "text-amber-700" },
    red: { badge: "bg-rose-50 text-rose-700 border-rose-100", text: "text-rose-700" },
    blue: { badge: "bg-blue-50 text-blue-700 border-blue-100", text: "text-blue-700" },
    orange: { badge: "bg-orange-50 text-orange-700 border-orange-100", text: "text-orange-700" },
    purple: { badge: "bg-purple-50 text-purple-700 border-purple-100", text: "text-purple-700" },
    cyan: { badge: "bg-cyan-50 text-cyan-700 border-cyan-100", text: "text-cyan-700" },
    indigo: { badge: "bg-indigo-50 text-indigo-700 border-indigo-100", text: "text-indigo-700" },
    pink: { badge: "bg-pink-50 text-pink-700 border-pink-100", text: "text-pink-700" },
    slate: { badge: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-700" },
    gray: { badge: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-700" },
  };

  const hit = palette[key];
  return {
    text: raw,
    className: hit?.badge || "bg-slate-50 text-slate-700 border-slate-200",
    textClass: hit?.text || "text-slate-700",
  };
}

/** Dropdown option row classes — Green selectable; DB saved = blue. */
export function billDropdownOptionClasses(item) {
  if (item?.bill_source === "db") {
    return "bg-blue-50 border-l-[3px] border-l-blue-500 [&>div>span:first-child]:!text-blue-600 [&>div>span:first-child]:font-semibold";
  }
  const statusKey = String(item?.status ?? "").trim().toLowerCase();
  const st = formatExternalBillStatus(item?.status);
  const labelColor = st.textClass.replace(/^text-/, "!text-");

  if (item?.is_green || statusKey === "green") {
    return `bg-emerald-50 border-l-[3px] border-l-emerald-500 [&>div>span:first-child]:${labelColor} [&>div>span:first-child]:font-semibold`;
  }

  const borderByStatus = {
    yellow: "border-l-amber-400 bg-amber-50/60",
    red: "border-l-rose-400 bg-rose-50/60",
    blue: "border-l-blue-400 bg-blue-50/60",
    orange: "border-l-orange-400 bg-orange-50/60",
  };
  const rowTone = borderByStatus[statusKey] || "border-l-slate-300 bg-slate-50/80";
  return `${rowTone} border-l-[3px] opacity-80 [&>div>span:first-child]:${labelColor}`;
}

/** Table cell text color — saved bill = blue (IMS). */
export function billSavedTextClass(hasBill) {
  return hasBill ? "text-blue-600" : "text-slate-400";
}
