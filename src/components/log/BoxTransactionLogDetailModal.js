"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import { History } from "lucide-react";
import GlobalDetailModal from "@/components/common/GlobalDetailModal";
import {
  MasterDetailBody,
  MasterDetailHero,
  MasterDetailGrid,
  MasterDetailSection,
  MasterDetailKV,
  MasterDetailMetrics,
  MasterDetailProse,
} from "@/components/master/MasterDetailLayout";

const SHOWN_DETAIL_KEYS = new Set([
  "count",
  "total_qty",
  "qty",
  "per_box_qty",
  "box_kind",
  "standard_count",
  "loose_count",
  "box_no_uids",
  "box_uids",
  "action",
]);

function parseDetails(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

function labelForKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function BoxTransactionLogDetailModal({ open, onClose, row, labelForType }) {
  const details = useMemo(() => parseDetails(row?.details), [row?.details]);

  const stickerNos = useMemo(() => {
    if (Array.isArray(details.box_no_uids) && details.box_no_uids.length) {
      return details.box_no_uids.map((u) => String(u).trim()).filter(Boolean);
    }
    if (row?.box_no_uids_display) {
      return String(row.box_no_uids_display)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [details.box_no_uids, row?.box_no_uids_display]);

  const extraEntries = useMemo(() => {
    return Object.entries(details).filter(
      ([k, v]) =>
        !SHOWN_DETAIL_KEYS.has(k) &&
        v != null &&
        v !== "" &&
        !(Array.isArray(v) && v.length === 0)
    );
  }, [details]);

  if (!row) return null;

  const typeLabel = labelForType?.(row.transaction_type) || row.transaction_type || "—";
  const ts = row.created_at ? dayjs(row.created_at).format("DD MMM YYYY · hh:mm:ss A") : "—";
  const moduleLabel = row.source_module?.replace(/_/g, " ") || "—";

  const stdCount = details.standard_count ?? (row.box_kind === "Standard" ? row.box_count : null);
  const looseCount = details.loose_count ?? (row.box_kind === "Loose" ? row.box_count : null);

  return (
    <GlobalDetailModal open={open} onClose={onClose} title="Box Transaction" icon={History} size="wide">
      <MasterDetailBody>
        <MasterDetailHero
          eyebrow="Transaction type"
          icon={History}
          title={typeLabel}
          badge={ts}
        />

        <MasterDetailMetrics
          columns={2}
          items={[
            { label: "Count", value: row.box_count ?? details.count ?? "—" },
            { label: "Qty", value: row.total_qty ?? details.total_qty ?? details.qty ?? "—", emphasis: false },
            { label: "Box type", value: row.box_kind ?? details.box_kind ?? "—" },
            {
              label: "Standard / Loose",
              value:
                stdCount != null || looseCount != null
                  ? `${stdCount ?? 0} / ${looseCount ?? 0}`
                  : "—",
            },
          ]}
        />

        <MasterDetailGrid columns={2}>
          <MasterDetailKV label="User" value={row.user_name || "System"} />
          <MasterDetailKV label="Log ID" value={row.id ?? "—"} />
          <MasterDetailKV label="Module" value={moduleLabel} />
          <MasterDetailKV label="Reference" value={row.source_id || "—"} />
          <MasterDetailKV label="Packing no." value={row.packing_number || "—"} />
          {details.per_box_qty != null ? (
            <MasterDetailKV label="Per box qty" value={details.per_box_qty} />
          ) : null}
        </MasterDetailGrid>

        <MasterDetailSection label={`Box sticker no. (${stickerNos.length})`} tone="indigo">
          {stickerNos.length ? (
            <div className="max-h-48 overflow-y-auto space-y-1 normal-case">
              {stickerNos.map((no) => (
                <p key={no} className="font-mono text-[10px] text-slate-800 tracking-tight break-all">
                  {no}
                </p>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 normal-case">—</span>
          )}
        </MasterDetailSection>

        {extraEntries.length > 0 ? (
          <MasterDetailProse label="Additional details" tone="slate">
            <dl className="space-y-2 normal-case">
              {extraEntries.map(([key, val]) => (
                <div key={key}>
                  <dt className="text-[9px] font-bold text-slate-400 uppercase">{labelForKey(key)}</dt>
                  <dd className="text-[11px] text-slate-700 font-mono break-all mt-0.5">
                    {formatScalar(val)}
                  </dd>
                </div>
              ))}
            </dl>
          </MasterDetailProse>
        ) : null}
      </MasterDetailBody>
    </GlobalDetailModal>
  );
}
