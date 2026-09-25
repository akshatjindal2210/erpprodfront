import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import { getCoilStickerEntries } from "@/apps/rmstore/lib/utils/coilTransactionStickerEntries";
import { getCoilTxTypeBadgeClass, parseDetails, resolveCoilTxTypeLabel } from "@/apps/rmstore/lib/utils/coilTransactionVisuals";
import { buildCoilFinderDetailRowsFromConfig } from "@/apps/rmstore/lib/finder/coilFinderFullRecordConfig.js";
import { formatFgWireSplitLine, formatPjobcardnoDisplay, resolveCoilJobCardLabel, resolveCoilMachineLabel } from "@/apps/rmstore/modules/coil/coilTableVisuals";

const TX_SKIP = new Set([
  "count", "coil_count", "total_qty", "qty", "coil_no_uids", "coil_no_uid", "coil_sticker_entries", "action",
  "item_dcode", "itemdcode", "register_locations", "reassign_lines", "reassign", "reassign_revert",
  // Already on the row / badge / reference — hide in journey (IMS box finder style)
  "out_uid", "in_uid", "entry_type", "entryType", "source_module", "mrn_uid", "sa_id", "ipr_uid", "qc_uid",
  "heat_no", "item_code", "item_desc", "acc_code", "acc_name", "per_coil_qty", "pjobcardno", "job_card_no", "macname",
]);

function formatReassignJourneyLine(ln) {
  if (!ln || typeof ln !== "object") return "—";
  const src = formatPjobcardnoDisplay(ln.source_pjobcardno) || "—";
  const tgt = formatPjobcardnoDisplay(ln.target_pjobcardno) || "—";
  const parts = [`${src} → ${tgt}`];
  const cut = Number(ln.consumed_qty);
  const bal = Number(ln.balance_qty);
  if (Number.isFinite(cut) && cut > 0) parts.push(`wire cut ${cut}`);
  if (Number.isFinite(bal) && bal > 0) parts.push(`balance ${bal}`);
  if (ln.out_uid != null && String(ln.out_uid).trim() !== "") parts.push(`OUT-${ln.out_uid}`);
  return parts.join(" · ");
}

function printStatusLabel(coil) {
  const n = Number(coil?.download_count);
  if (Number.isFinite(n) && n > 0) return n === 1 ? "Printed (1)" : `Printed (${n})`;
  if (coil?.sticker_generated === true) return "Generated · Not printed";
  return "Not printed";
}

function formatJourneyValue(v) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) {
    const parts = v.map((item) => formatJourneyValue(item)).filter((s) => s && s !== "—");
    return parts.length ? parts.join(", ") : "—";
  }
  if (typeof v === "object") {
    if (v.source_pjobcardno != null || v.target_pjobcardno != null || v.consumed_qty != null || v.balance_qty != null) {
      return formatReassignJourneyLine(v);
    }
    const locNo = String(v.location_no ?? v.locationNo ?? "").trim();
    if (locNo) {
      const n = Number(v.coil_count);
      return Number.isFinite(n) ? `${locNo} (${n} coil${n === 1 ? "" : "s"})` : locNo;
    }
    if (v.location_id != null) {
      const n = Number(v.coil_count);
      const id = `LOC-${v.location_id}`;
      return Number.isFinite(n) ? `${id} (${n} coil${n === 1 ? "" : "s"})` : id;
    }
    if (v.coil_no_uid) return String(v.coil_no_uid);
    try {
      return JSON.stringify(v);
    } catch {
      return "—";
    }
  }
  return String(v);
}

const fmt = (v) => formatJourneyValue(v);

const hasDetailValue = (v) => {
  if (v == null || v === "") return false;
  if (typeof v === "string" && (!v.trim() || v.trim() === "—")) return false;
  if (Array.isArray(v) && !v.length) return false;
  return true;
};

const push = (rows, label, value) => {
  if (!hasDetailValue(value)) return;
  rows.push({ label, value: fmt(value) });
};

const sortEvents = (events) =>
  [...events].sort((a, b) => {
    const ta = a?.at ? new Date(a.at).getTime() : 0;
    const tb = b?.at ? new Date(b.at).getTime() : 0;
    return ta !== tb ? tb - ta : String(b?.id ?? "").localeCompare(String(a?.id ?? ""));
});

export function coilJourneyKey(coil) {
  return String(coil?.coil_no_uid ?? coil?.coil_uid ?? "").trim();
}

export function coilHasQcLink(coil) {
  return (
    coil?.qc_uid != null ||
    coil?.rm_uid != null ||
    String(coil?.qc_check_status ?? "").trim() !== ""
  );
}

/** Coil detail rows — aligned with print report (coilFinderReportSchema) + finder-only ops fields. */
export function buildCoilDetailRows(coil) {
  if (!coil) return [];
  return [
    // Canonical print set (same labels/order as backend COIL_DETAIL_FIELDS)
    ["MRN UID", coil.mrn_uid],
    ["MRN Date", coil.mrn_dt ? formatDocDate(coil.mrn_dt) : null],
    ["Heat No", coil.heat_no],
    ["RM Wire Item", coil.item_code],
    ["RM Wire Description", coil.item_desc],
    ...(Array.isArray(coil.fg_wire_splits) && coil.fg_wire_splits.length
      ? coil.fg_wire_splits.flatMap((split, idx) => {
          const line = formatFgWireSplitLine(split);
          const desc =
            split.fg_item_desc &&
            String(split.fg_item_desc).trim() &&
            String(split.fg_item_desc).trim().toUpperCase() !== String(split.fg_item_code || "").trim().toUpperCase()
              ? split.fg_item_desc
              : null;
          const rows = [[`FG · wire ${idx + 1}`, line]];
          if (desc) rows.push([`FG desc ${idx + 1}`, desc]);
          return rows;
        })
      : [
          ["FG Item", coil.fg_item_code],
          ["FG Description", coil.fg_item_desc],
        ]),
    ["RM Spec", coil.rm_spec_code || coil.rm_spec_label],
    ["Qty", coil.qty],
    ["Bill Number", coil.bill_no],
    ["Bill Date", coil.bill_dt ? formatDocDate(coil.bill_dt) : null],
    ["QC ID", coil.qc_uid != null ? `QC-${coil.qc_uid}` : null],
    ["QC Status", coil.qc_check_status],
    ["Job Card", resolveCoilJobCardLabel(coil)],
    ["Machine", resolveCoilMachineLabel(coil)],
    ["Created At", coil.created_at ? formatDateTime(coil.created_at) : null],
    ["Updated At", coil.updated_at ? formatDateTime(coil.updated_at) : null],
    // Finder screen only (print puts Coil UID / Vendor in the header)
    ["Coil UID", coil.coil_no_uid],
    ["Vendor", coil.acc_name],
    ["RM ID", coil.rm_uid],
    ["Inward UID", coil.in_uid != null ? `IN-${coil.in_uid}` : null],
    ["IPR ID", coil.ipr_uid != null ? String(coil.ipr_uid) : null],
    ["Outward UID", coil.out_uid != null ? `OUT-${coil.out_uid}` : null],
    ["Stock Adjustment ID", coil.sa_id],
    ["SA Entry Type", coil.sa_entry_type],
    ["Status", coil.status],
  ]
    .filter(([, value]) => hasDetailValue(value))
    .map(([label, value]) => ({ label, value: fmt(value) }));
}

/** Full record grid — driven by `coilFinderFullRecordFields` (edit show / order there). */
export function buildCoilFinderDetailRows(coil) {
  return buildCoilFinderDetailRowsFromConfig(coil);
}

function appendScalarDetailLines(lines, details, row) {
  const ref = String(row?.source_id ?? "").trim();
  Object.entries(details || {}).forEach(([k, v]) => {
    if (TX_SKIP.has(k)) return;
    if (v == null || v === "") return;
    if (Array.isArray(v) || typeof v === "object") return;
    if (ref && (k === "out_uid" || k === "in_uid" || k === "sa_id" || k === "ipr_uid") && String(v).trim() === ref) {
      return;
    }
    push(lines, k.replace(/_/g, " "), v);
  });
}

function buildTxEvent(row, typeLabels, focusUid) {
  const d = parseDetails(row?.details);
  const lines = [];
  const txType = row?.transaction_type;
  push(lines, "User", row?.user_name || "System");
  push(lines, "Reference", row?.source_id);
  push(lines, "Coil Count", row?.coil_count ?? d.coil_count ?? d.count);
  push(lines, "Qty", row?.total_qty ?? d.total_qty ?? d.qty);
  const stickers = getCoilStickerEntries(row);
  if (stickers.length) {
    lines.push({ label: "Coil Sticker No.", stickers, focusUid: focusUid || null });
  }
  if (txType === "ipr_reassign" && Array.isArray(d.reassign_lines) && d.reassign_lines.length) {
    d.reassign_lines.forEach((ln, idx) => {
      push(lines, d.reassign_lines.length > 1 ? `Reassign ${idx + 1}` : "Reassign", formatReassignJourneyLine(ln));
    });
  }
  if (txType === "ipr_reassign_revert" && d.reassign_revert === true) {
    push(lines, "Note", "Reassign approval was reverted");
  }
  const jc = d.pjobcardno || d.job_card_no;
  if (jc) push(lines, "Job Card", formatPjobcardnoDisplay(jc));
  if (d.macname) push(lines, "Machine", d.macname);
  appendScalarDetailLines(lines, d, row);
  return {
    id: `tx-${row?.id}`,
    at: row?.created_at ?? null,
    title: resolveCoilTxTypeLabel(row?.transaction_type, row, typeLabels),
    badgeClass: getCoilTxTypeBadgeClass(row?.transaction_type, row),
    lines,
  };
}

function mapServerDocuments(documents = []) {
  return documents
    .map((d) => {
      const path = d.path || d.publicPath || "";
      const url = d.url || qcDocUrl(path);
      if (!url) return null;
      return {
        ...d,
        url,
        fileName: d.fileName || d.file_name || qcDocName(path) || "Document",
      };
    })
    .filter(Boolean);
}

/** Map data.finder from POST /coils/helper (finder: true) into UI panels — no extra API. */
export function panelsFromCoilFinder(coil) {
  const baseDetails = buildCoilFinderDetailRows(coil);
  const empty = { details: baseDetails, events: [], qcChecks: [], documents: [] };
  if (!coil?.finder) return empty;
  return mapFinderBundle(coil.finder, coil, baseDetails);
}

function mapFinderBundle(finder, coil, baseDetails) {
  const typeLabels = finder?.typeLabels || {};
  const focusUid = coilJourneyKey(coil);
  const events = sortEvents(
    (finder?.transactionLogs || []).map((r) => buildTxEvent(r, typeLabels, focusUid))
  );
  const qcChecks = (finder?.qcChecks || []).map((row) => normalizeQc(row)).filter(Boolean);
  const details = baseDetails.length ? baseDetails : buildCoilFinderDetailRows(coil);
  return {
    details,
    events,
    qcChecks,
    documents: mapServerDocuments(finder?.documents),
  };
}

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeQc(row) {
  if (!row) return null;
  const items = parseItems(row.items)
    .map((it, i) => ({ ...it, sno: it?.sno ?? i + 1 }))
    .sort((a, b) => Number(a.sno) - Number(b.sno));
  return { ...row, items };
}

export function qcExpected(spec) {
  const t = String(spec?.spec_type || "").toLowerCase();
  if (t === "min") return `≥ ${Number(spec?.min_value) || 0}`;
  if (t === "max") return `≤ ${Number(spec?.max_value) || 0}`;
  if (t === "range") return `${Number(spec?.min_value) || 0} – ${Number(spec?.max_value) || 0}`;
  if (t === "dropdown") {
    return (
      String(spec?.correct_option || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .join(" | ") || "—"
    );
  }
  const pv = spec?.print_val;
  return pv != null && String(pv).trim() ? String(pv).trim() : "—";
}

export function qcLineResult(spec) {
  const stored = String(spec?.result || "").toLowerCase();
  if (stored === "pass" || stored === "fail") return stored;
  const t = String(spec?.spec_type || "").toLowerCase();
  const actualText = spec?.actual_value == null ? "" : String(spec.actual_value).trim();
  if (!actualText) return null;
  if (t === "dropdown") {
    const actualUpper = actualText.toUpperCase();
    const ok = String(spec?.correct_option || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .some((opt) => opt === actualUpper);
    return ok ? "pass" : "fail";
  }
  const n = Number(actualText);
  if (!Number.isFinite(n)) return "fail";
  const min = Number(spec?.min_value);
  const max = Number(spec?.max_value);
  if (t === "min") return n >= (Number.isFinite(min) ? min : 0) ? "pass" : "fail";
  if (t === "max") return n <= (Number.isFinite(max) ? max : 0) ? "pass" : "fail";
  if (t === "range") {
    const lo = Number.isFinite(min) ? min : 0;
    const hi = Number.isFinite(max) ? max : 0;
    return n >= lo && n <= hi ? "pass" : "fail";
  }
  return "fail";
}

export function qcDocUrl(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  let path = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (path.startsWith("rmstore/")) path = `uploads/${path}`;
  if (!path.startsWith("uploads/") && /^[\w.\-]+\.(pdf|png|jpe?g|webp|gif)$/i.test(path)) {
    path = `uploads/rmstore/qc/${path}`;
  }
  return path.startsWith("uploads/")
    ? `${String(FILE_BASE_URL || "").replace(/\/$/, "")}/${path}`
    : "";
}

export function qcDocName(note) {
  if (!note) return "";
  const parts = String(note).split(/[/\\]/);
  return parts[parts.length - 1] || note;
}

function qcOverall(check) {
  const st = String(check?.status || "").toLowerCase();
  if (st === "passed" || st === "pass") return "pass";
  if (st === "failed" || st === "fail") return "fail";
  const rs = (check?.items || []).map(qcLineResult).filter(Boolean);
  if (rs.length && rs.every((r) => r === "pass")) return "pass";
  if (rs.some((r) => r === "fail")) return "fail";
  return null;
}

export function buildQcSummary(check) {
  const overall = qcOverall(check);
  return [
    { label: "QC ID", value: check?.qc_check_uid != null ? `QC-${check.qc_check_uid}` : "—" },
    { label: "Status", value: check?.status || "—" },
    { label: "Inspected By", value: check?.inspected_by_name || check?.inspected_by || "—" },
    { label: "Inspected At", value: check?.inspected_at ? formatDateTime(check.inspected_at) : "—" },
    { label: "Approved By", value: check?.approved_by_name || check?.approved_by || "—" },
    { label: "Approved At", value: check?.approved_at ? formatDateTime(check.approved_at) : "—" },
    { label: "Created At", value: check?.created_at ? formatDateTime(check.created_at) : "—" },
    { label: "Updated At", value: check?.updated_at ? formatDateTime(check.updated_at) : "—" },
    { label: "Failure Reason", value: check?.failure_reason || "—" },
    { label: "Remarks", value: check?.remarks || "—" },
    { label: "QC Reject UID", value: check?.qc_reject_uid ?? "—" },
  ];
}

