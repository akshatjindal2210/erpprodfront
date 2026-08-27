import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { fetchAllListPages } from "@/ui/common/list/clientListSearch";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import { labelStickerDownloadSource } from "@/platform/utils/global";
import { resolveCoilLocationLabel } from "@/apps/rmstore/modules/coil/coilTableVisuals";
import { getCoilStickerEntries } from "@/apps/rmstore/lib/utils/coilTransactionStickerEntries";
import { getCoilTxTypeBadgeClass, parseDetails, resolveCoilTxTypeLabel } from "@/apps/rmstore/lib/utils/coilTransactionVisuals";
import { coilTransactionLogService, stickerDownloadLogService } from "@/apps/rmstore/lib/services/coilLogs";
import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { stockAdjustmentService } from "@/apps/rmstore/lib/services/stockAdjustment";
import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";

const TX_SKIP = new Set([
  "count", "coil_count", "total_qty", "qty", "coil_no_uids", "coil_no_uid", "coil_sticker_entries", "action",
  "item_dcode", "itemdcode", "register_locations",
]);

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

export function buildCoilDetailRows(coil) {
  if (!coil) return [];
  return [
    ["Coil UID", coil.coil_no_uid],
    ["MRN UID", coil.mrn_uid],
    ["MRN Date", coil.mrn_dt ? formatDocDate(coil.mrn_dt) : null],
    ["Heat No", coil.heat_no],
    ["Item Code", coil.item_code],
    ["Description", coil.item_desc],
    ["Vendor", coil.acc_name],
    ["Qty", coil.qty],
    ["QC ID", coil.qc_uid != null ? `QC-${coil.qc_uid}` : null],
    ["QC Status", coil.qc_check_status],
    ["RM ID", coil.rm_uid],
    ["Inward UID", coil.in_uid != null ? `IN-${coil.in_uid}` : null],
    ["IPR ID", coil.ipr_uid != null ? String(coil.ipr_uid) : null],
    ["Outward UID", coil.out_uid != null ? `OUT-${coil.out_uid}` : null],
    ["Job Card", coil.pjobcardno],
    ["Machine", coil.macname],
    ["Stock Adjustment ID", coil.sa_id],
    ["SA Entry Type", coil.sa_entry_type],
    ["Bill Number", coil.bill_no],
    ["Bill Date", coil.bill_dt ? formatDocDate(coil.bill_dt) : null],
    ["Status", coil.status],
    ["Created At", coil.created_at ? formatDateTime(coil.created_at) : null],
    ["Updated At", coil.updated_at ? formatDateTime(coil.updated_at) : null],
  ]
    .filter(([, value]) => hasDetailValue(value))
    .map(([label, value]) => ({ label, value: fmt(value) }));
}

function extraDetailLines(details) {
  return Object.entries(details || {})
    .filter(([k, v]) => !TX_SKIP.has(k) && v != null && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: fmt(v) }));
}

function buildTxEvent(row, typeLabels) {
  const d = parseDetails(row?.details);
  const lines = [];
  push(lines, "User", row?.user_name || "System");
  push(lines, "Module", row?.source_module?.replace(/_/g, " "));
  push(lines, "Reference", row?.source_id);
  push(lines, "MRN UID", row?.mrn_uid);
  push(lines, "Coil Count", row?.coil_count ?? d.coil_count ?? d.count);
  push(lines, "Qty", row?.total_qty ?? d.total_qty ?? d.qty);
  const stickers = getCoilStickerEntries(row);
  if (stickers.length) {
    push(
      lines,
      "Coil Sticker No.",
      stickers.map((e) => (Number.isFinite(Number(e.qty)) ? `${e.coil_no_uid} (qty ${e.qty})` : e.coil_no_uid)).join(", ")
    );
  }
  extraDetailLines(d).forEach(({ label, value }) => push(lines, label, value));
  return {
    id: `tx-${row?.id}`,
    at: row?.created_at ?? null,
    title: resolveCoilTxTypeLabel(row?.transaction_type, row, typeLabels),
    badgeClass: getCoilTxTypeBadgeClass(row?.transaction_type, row),
    lines,
  };
}

function buildStickerEvent(row) {
  const lines = [];
  push(lines, "Downloaded By", row?.downloaded_by ?? row?.last_downloaded_by_name);
  push(lines, "Download Type", row?.download_type ?? row?.last_download_type);
  push(lines, "Sticker Count", row?.sticker_count ?? row?.event_sticker_count);
  push(lines, "Source", labelStickerDownloadSource(row?.download_source));
  push(lines, "MRN UID", row?.mrn_uid);
  push(lines, "Coil Sticker No", row?.coil_no_uid ?? row?.primary_label);
  push(lines, "Heat No", row?.heat_no);
  push(lines, "Item Code", row?.item_code);
  push(lines, "Vendor", row?.acc_name);
  return {
    id: `sticker-${row?.log_id ?? row?.id}`,
    at: row?.downloaded_at ?? row?.last_downloaded_at ?? null,
    title: "Sticker Download",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-100",
    lines,
  };
}

async function loadJourneyPages(getPage) {
  let typeLabels = {};
  const { data } = await fetchAllListPages(async (page, limit) => {
    const res = await getPage(page, limit);
    if (page === 1 && res?.typeLabels) typeLabels = res.typeLabels;
    return res;
  }, 500, 10000);
  return { rows: data ?? [], typeLabels };
}

function pushUploadDoc(docs, { id, label, sub, path, name, kind }) {
  const url = qcDocUrl(path);
  if (!url) return;
  docs.push({
    id,
    label,
    sub,
    url,
    fileName: name || qcDocName(path) || "Document",
    kind,
  });
}

/** All QC spec upload paths for the finder documents panel. */
export function collectQcDocuments(checks) {
  const docs = [];
  for (const check of checks || []) {
    const qcLabel = check?.qc_check_uid != null ? `QC-${check.qc_check_uid}` : "QC";
    for (const spec of check?.items || []) {
      const note = spec?.document_note;
      if (!note) continue;
      const url = qcDocUrl(note);
      if (!url) continue;
      docs.push({
        id: `qc-${check.qc_check_uid}-${spec.spec_id ?? spec.sno}`,
        label: spec.spec_name || `Spec ${spec.sno ?? ""}`.trim(),
        sub: `${qcLabel} · uploaded with check`,
        url,
        fileName: qcDocName(note) || "Document",
        kind: "qc",
      });
    }
  }
  return docs;
}

async function fetchStickerUploadDocs(coil) {
  const uploadDocs = [];

  const mrnUid = coil?.mrn_uid != null ? String(coil.mrn_uid).trim() : "";
  const saId = coil?.sa_id != null ? Number(coil.sa_id) : null;
  const isSaCoil = saId && String(coil?.sa_entry_type || "").toLowerCase() === "stock_in";

  if (mrnUid) {
    try {
      const res = await mrnService.getDetail(mrnUid);
      const m = res?.data;
      if (m) {
        pushUploadDoc(uploadDocs, {
          id: `tc-mrn-${mrnUid}`,
          label: "TC Document",
          sub: "Uploaded when coil stickers were generated",
          path: m.tc_file_path,
          name: m.tc_file_name,
          kind: "tc",
        });
        pushUploadDoc(uploadDocs, {
          id: `rmtc-mrn-${mrnUid}`,
          label: "RMTC Document",
          sub: "Uploaded when coil stickers were generated",
          path: m.rmtc_file_path,
          name: m.rmtc_file_name,
          kind: "rmtc",
        });
      }
    } catch {
      /* permission or missing MRN */
    }
    return uploadDocs;
  }

  if (isSaCoil) {
    try {
      const res = await stockAdjustmentService.getById(saId);
      const sa = res?.data;
      if (sa) {
        pushUploadDoc(uploadDocs, {
          id: `tc-sa-${saId}`,
          label: "TC Document",
          sub: "Uploaded when stock adjustment stickers were generated",
          path: sa.tc_file_path,
          name: sa.tc_file_name,
          kind: "tc",
        });
        pushUploadDoc(uploadDocs, {
          id: `rmtc-sa-${saId}`,
          label: "RMTC Document",
          sub: "Uploaded when stock adjustment stickers were generated",
          path: sa.rmtc_file_path,
          name: sa.rmtc_file_name,
          kind: "rmtc",
        });
      }
    } catch {
      /* permission */
    }
  }

  return uploadDocs;
}

async function fetchIprRejectionDocs(coil) {
  const iprUid = coil?.ipr_uid != null ? Number(coil.ipr_uid) : null;
  if (!Number.isFinite(iprUid) || iprUid <= 0) return [];
  try {
    const res = await inProcessRequestService.getByHelper(iprUid, {
      permission_module: "rm_coils",
      permission_action: "view",
    });
    const row = res?.data;
    if (!row || String(row.request_type || "").toLowerCase() !== "rejection") return [];
    const docs = [];
    (row.attachments || []).forEach((path, i) => {
      pushUploadDoc(docs, {
        id: `ipr-${iprUid}-${i}`,
        label: `Rejection photo ${i + 1}`,
        sub: `IPR #${iprUid}`,
        path,
        name: qcDocName(path),
        kind: "ipr",
      });
    });
    return docs;
  } catch {
    return [];
  }
}

export async function fetchCoilFinderData(coil) {
  const key = coilJourneyKey(coil);
  const empty = {
    details: buildCoilDetailRows(coil),
    events: [],
    qcChecks: [],
    documents: [],
  };
  if (!key) return empty;

  const [journeyRes, qcChecks, uploadDocs, iprDocs] = await Promise.all([
    loadJourneyPages((page, limit) =>
      coilTransactionLogService.getAll({
        page,
        limit,
        filters: { journey: key },
        sortBy: "created_at",
        order: "DESC",
      })
    ).then(async ({ rows, typeLabels }) => {
      let stickerRows = [];
      try {
        const sticker = await fetchAllListPages(
          (page, limit) =>
            stickerDownloadLogService.getAll({
              page,
              limit,
              filters: { journey: key },
              sortBy: "downloaded_at",
              order: "DESC",
            }),
          500,
          5000
        );
        stickerRows = sticker.data ?? [];
      } catch {
        stickerRows = [];
      }
      return sortEvents([
        ...rows.map((r) => buildTxEvent(r, typeLabels)),
        ...stickerRows.map(buildStickerEvent),
      ]);
    }),
    fetchCoilQcChecks(coil),
    fetchStickerUploadDocs(coil),
    fetchIprRejectionDocs(coil),
  ]);

  const documents = [...iprDocs, ...collectQcDocuments(qcChecks), ...uploadDocs];

  return {
    details: buildCoilDetailRows(coil),
    events: journeyRes,
    qcChecks,
    documents,
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

async function fetchCoilQcChecks(coil) {
  const uid = String(coil?.coil_no_uid ?? "").trim();
  if (!uid) return [];

  const map = new Map();
  try {
    const { data } = await fetchAllListPages(
      (page, limit) =>
        qcCheckService.getAll({
          page,
          limit,
          filters: { coil_no_uid: uid },
          sortBy: "qc_check_uid",
          order: "ASC",
        }),
      100,
      200
    );
    for (const row of data || []) {
      const n = normalizeQc(row);
      if (n?.qc_check_uid != null) map.set(Number(n.qc_check_uid), n);
    }
  } catch {
    /* permission */
  }

  const linked = coil?.qc_uid != null ? Number(coil.qc_uid) : null;
  if (linked && !map.has(linked)) {
    try {
      const res = await qcCheckService.getById(linked);
      const n = normalizeQc(res?.data);
      if (n) map.set(linked, n);
    } catch {
      /* ignore */
    }
  }

  return [...map.values()].sort((a, b) => Number(a.qc_check_uid) - Number(b.qc_check_uid));
}
