import { buildLocationLabelDataUrlFromSvg, buildLocationLabelDataUrlsForRows, printLocationLabelDataUrls } from "@/apps/ims/lib/helpers/locationQrLabel";
import { isTrayPrintable, sortTraysAsc } from "@/apps/ims/lib/helpers/trayHelper";

function asLocationShape(tray) {
  return {
    location_id: tray?.id ?? null,
    location_no: tray?.code || "",
    rack_no: tray?.code || "",
    shelf_no: "",
  };
}

export function getTrayQrValue(row) {
  return String(row?.code || "").trim().toUpperCase();
}

export async function buildTrayLabelDataUrlFromSvg(svgElement, tray) {
  return buildLocationLabelDataUrlFromSvg(svgElement, asLocationShape(tray));
}

export async function buildTrayLabelDataUrlsForRows(rows = []) {
  return buildLocationLabelDataUrlsForRows((rows || []).map(asLocationShape));
}

export function printTrayLabelDataUrls(dataUrls = []) {
  return printLocationLabelDataUrls(dataUrls);
}

export function downloadTrayLabelDataUrl(row, dataUrl) {
  const code = String(row?.code || row?.id || "label").trim();
  const link = document.createElement("a");
  link.download = `TRAY_${code}.png`;
  link.href = dataUrl;
  link.click();
}

const CHUNK_SIZE = 100;

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

/** Bulk print or download tray QR labels — approved + active only, ASC print order. */
export async function runTrayLabelBulkExport(mode, rows = []) {
  const list = sortTraysAsc((Array.isArray(rows) ? rows : []).filter(isTrayPrintable));
  if (!list.length) {
    return { ok: false, reason: "empty" };
  }

  const chunks = chunkRows(list, CHUNK_SIZE);
  const urls = [];
  for (const chunk of chunks) {
    const part = await buildTrayLabelDataUrlsForRows(chunk);
    urls.push(...part);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (mode === "print") {
    const ok = printTrayLabelDataUrls(urls);
    return ok ? { ok: true, count: list.length } : { ok: false, reason: "popup" };
  }

  for (let i = 0; i < list.length; i++) {
    downloadTrayLabelDataUrl(list[i], urls[i]);
    if (i < list.length - 1) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return { ok: true, count: list.length };
}
