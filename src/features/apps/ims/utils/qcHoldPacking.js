import { normalizeBoxNoUidPrefix } from "@/core/utils/global";

export function parseQcHoldBoxIndex(boxNoUid) {
  const parts = String(boxNoUid ?? "").trim().split("_");
  const last = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(last) && last > 0 ? last : 0;
}

/** `{prefix}_{packing}_QCH{holdId}_{total}_{index}` — keep in sync with backend boxUid.js */
export function formatQcHoldBoxNoUid(packingNumber, holdId, totalBoxes, boxIndex, prefix = "") {
  const pn = String(packingNumber ?? "").trim();
  const hid = parseInt(String(holdId), 10);
  const tb = parseInt(String(totalBoxes), 10);
  const bi = parseInt(String(boxIndex), 10);
  if (!pn || !Number.isFinite(hid) || hid < 1 || !Number.isFinite(tb) || tb < 1 || !Number.isFinite(bi) || bi < 1) {
    return "";
  }
  const core = `${pn}_QCH${hid}_${tb}_${bi}`;
  const pfx = normalizeBoxNoUidPrefix(prefix);
  return pfx ? `${pfx}_${core}` : core;
}
