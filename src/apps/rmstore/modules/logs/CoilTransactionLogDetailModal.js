"use client";

import { useMemo } from "react";
import { History } from "lucide-react";
import { formatDayjs } from "@/platform/utils/core/utilHelper";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import {
  MasterDetailBody,
  MasterDetailHero,
  MasterDetailGrid,
  MasterDetailSection,
  MasterDetailKV,
  MasterDetailMetrics,
  MasterDetailProse,
} from "@/apps/ims/modules/master/MasterDetailLayout";
import { getCoilStickerEntries } from "@/apps/rmstore/lib/utils/coilTransactionStickerEntries";
import { resolveCoilTxTypeLabel } from "@/apps/rmstore/lib/utils/coilTransactionVisuals";

const SHOWN_DETAIL_KEYS = new Set([
  "count",
  "coil_count",
  "total_qty",
  "qty",
  "coil_no_uids",
  "coil_no_uid",
  "coil_sticker_entries",
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

export default function CoilTransactionLogDetailModal({ open, onClose, row, labelForType }) {
  const details = useMemo(() => parseDetails(row?.details), [row?.details]);
  const stickerEntries = useMemo(() => getCoilStickerEntries(row), [row]);

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

  const typeLabel =
    labelForType?.(row.transaction_type, row) ||
    resolveCoilTxTypeLabel(row.transaction_type, row) ||
    "—";
  const ts = formatDayjs(row.created_at, "DD MMM YYYY · hh:mm:ss A");
  const moduleLabel = row.source_module?.replace(/_/g, " ") || "—";

  return (
    <GlobalDetailModal open={open} onClose={onClose} title="Coil Transaction" icon={History} size="wide">
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
            { label: "Count", value: row.coil_count ?? details.coil_count ?? details.count ?? "—" },
            { label: "Qty", value: row.total_qty ?? details.total_qty ?? details.qty ?? "—", emphasis: false },
          ]}
        />

        <MasterDetailGrid columns={2}>
          <MasterDetailKV label="User" value={row.user_name || "System"} />
          <MasterDetailKV label="Log ID" value={String(row.id ?? "").split("::")[0] || "—"} />
          <MasterDetailKV label="Module" value={moduleLabel} />
          <MasterDetailKV label="Reference" value={row.source_id || "—"} />
          <MasterDetailKV label="MRN" value={row.mrn_no || "—"} />
        </MasterDetailGrid>

        <MasterDetailSection label={`Coil sticker no. (${stickerEntries.length})`} tone="indigo">
          {stickerEntries.length ? (
            <div className="max-h-48 overflow-y-auto space-y-1 normal-case">
              {stickerEntries.map((e) => (
                <p
                  key={e.coil_no_uid}
                  className="font-mono text-[10px] tracking-tight break-all text-slate-800"
                >
                  {e.coil_no_uid}
                  {Number.isFinite(Number(e.qty)) ? (
                    <span className="text-slate-400 ml-2">qty {e.qty}</span>
                  ) : null}
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
