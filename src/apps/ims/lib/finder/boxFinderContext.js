import { getBoxStockZone, resolveBoxLocationLabel } from "@/apps/ims/modules/box/boxTableVisuals";

/** Tray type prefix from code (FG / RM) — matches Tray Master `type`. */
export function trayTypeFromTrayCode(trayCode) {
  const u = String(trayCode ?? "").trim().toUpperCase();
  if (/^FG\d/i.test(u) || u === "FG") return "FG";
  if (/^RM\d/i.test(u) || u === "RM") return "RM";
  return null;
}

export function getBoxTrayContext(box) {
  const trayRaw = box?.tray_code ?? box?.trayCode;
  const trayCode =
    trayRaw != null && String(trayRaw).trim() !== "" ? String(trayRaw).trim().toUpperCase() : null;
  const trayType =
    (box?.tray_type != null && String(box.tray_type).trim() !== ""
      ? String(box.tray_type).trim().toUpperCase()
      : null) || trayTypeFromTrayCode(trayCode);
  const stockLabel = resolveBoxLocationLabel(box);
  const zone = getBoxStockZone(box);
  return { trayCode, trayType, stockLabel, zone };
}
