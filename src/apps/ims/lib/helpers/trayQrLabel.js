/** Tray QR — IMS 50×25 mm label (not RM Store location sticker). */
import {
  buildLocationLabelDataUrlsForRows,
  printLocationLabelDataUrls,
} from "@/apps/ims/lib/helpers/locationQrLabel";
import { trayQrLabelSizeText } from "@/apps/ims/lib/config/trayQrPrintSize.config";
import { isTrayPrintable, sortTraysAsc } from "@/apps/ims/lib/helpers/trayHelper";
import { trayService } from "@/apps/ims/lib/services/tray";

export function trayLabelSizeText() {
  return trayQrLabelSizeText();
}

function trayLabelLines(tray) {
  const type = String(tray?.type ?? "").trim().toUpperCase();
  if (!type) return null;
  const serialRaw = tray?.serial_number;
  if (serialRaw != null && String(serialRaw).trim() !== "") {
    const n = Number(serialRaw);
    const serial = Number.isFinite(n) ? String(Math.trunc(n)).padStart(3, "0") : String(serialRaw).trim();
    return [type, serial];
  }
  const code = String(tray?.code || "").trim().toUpperCase();
  if (code.startsWith(type)) {
    const rest = code.slice(type.length).trim();
    if (rest) return [type, rest];
  }
  return null;
}

async function trayQrPayloadMap(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(
    (t) => Number(t?.id) > 0 || String(t?.code || "").trim()
  );
  if (!list.length) return {};
  try {
    const res = await trayService.getQrPayloads(list);
    return res?.data?.payloads ?? {};
  } catch {
    return {};
  }
}

function trayQrValue(tray, payloads) {
  const code = String(tray?.code || "").trim().toUpperCase();
  if (tray?.qr_value) return String(tray.qr_value).trim();
  if (code && payloads[code]) return String(payloads[code]).trim();
  const id = Number(tray?.id);
  if (id > 0 && payloads[String(id)]) return String(payloads[String(id)]).trim();
  return code;
}

export async function buildTrayLabelDataUrlsForRows(rows = []) {
  const payloads = await trayQrPayloadMap(rows);
  const shaped = rows.map((tray) => {
    const code = String(tray?.code || "").trim().toUpperCase();
    const lines = trayLabelLines(tray);
    return {
      location_id: tray?.id ?? null,
      location_no: code,
      qr_value: trayQrValue(tray, payloads),
      ...(lines ? { label_lines: lines } : {}),
    };
  });
  return buildLocationLabelDataUrlsForRows(shaped);
}

export function printTrayLabelDataUrls(dataUrls = []) {
  return printLocationLabelDataUrls(dataUrls);
}

function downloadTrayLabelDataUrl(row, dataUrl) {
  const code = String(row?.code || row?.id || "label").trim();
  const link = document.createElement("a");
  link.download = `TRAY_${code}.png`;
  link.href = dataUrl;
  link.click();
}

export async function runTrayLabelBulkExport(mode, rows = []) {
  const list = sortTraysAsc((Array.isArray(rows) ? rows : []).filter(isTrayPrintable));
  if (!list.length) return { ok: false, reason: "empty" };

  const urls = [];
  for (let i = 0; i < list.length; i += 100) {
    urls.push(...(await buildTrayLabelDataUrlsForRows(list.slice(i, i + 100))));
    await new Promise((r) => setTimeout(r, 0));
  }

  if (mode === "print") {
    const ok = printTrayLabelDataUrls(urls);
    return ok ? { ok: true, count: list.length } : { ok: false, reason: "popup" };
  }

  for (let i = 0; i < list.length; i++) {
    downloadTrayLabelDataUrl(list[i], urls[i]);
    if (i < list.length - 1) await new Promise((r) => setTimeout(r, 120));
  }
  return { ok: true, count: list.length };
}
