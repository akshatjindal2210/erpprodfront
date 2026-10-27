import React from "react";
import QRCode from "react-qr-code";
import { QR_LABEL_PRINT, buildQrLabelPrintDocumentHtml, qrLabelPrintCssMm } from "@/platform/config/qrLabelPrintSize.config";

const LABEL_W_MM = QR_LABEL_PRINT.locationAndMachineMm.widthMm;
const LABEL_H_MM = QR_LABEL_PRINT.locationAndMachineMm.heightMm;
const PX_PER_MM = 12;

/**
 * IMS Location label layout — paper mm → qrLabelPrintSize.config.js; tuning below.
 * Bigger QR: raise QR_COLUMN_RATIO, CONTENT_H_RATIO; lower INNER_GAP_* / COL_GAP.
 * Smaller QR: lower QR_COLUMN_RATIO; more gap if needed.
 */
const CONTENT_W_RATIO = 0.92;   // usable width on label (0.88–0.95)
const CONTENT_H_RATIO = 0.82;   // usable height — higher = taller QR (0.74–0.88)
const QR_COLUMN_RATIO = 0.58;   // left side % for QR vs rack/shelf text (0.48–0.65)
const COL_GAP = 6;              // gap between QR block and text block
const INNER_GAP_X = 6;          // padding inside QR column
const INNER_GAP_Y = 6;          // padding inside QR column (height limit)
const QR_SOURCE_PX = 256;       // QR render sharpness (200–320); not visual size on label

export function getLocationQrValue(data) {
  return (data?.location_no || `${data?.rack_no || ""}${(data?.shelf_no || "").toString().toUpperCase()}` || "")
    .toString()
    .trim()
    .toUpperCase();
}

function requireLocationQrValue(data) {
  const value = getLocationQrValue(data);
  if (!value) {
    throw new Error("Location code is missing (location no. or rack/shelf).");
  }
  return value;
}

function getQrEncodeValue(data) {
  const custom = String(data?.qr_value ?? "").trim();
  if (custom) return custom;
  return requireLocationQrValue(data);
}

/** Two-line tray text (FG + serial) — lines close together, block centered vertically. */
function drawCompactTrayTextBlock(ctx, lines, centerX, blockTop, blockH, maxWidth) {
  const rows = (lines || []).map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!rows.length) return;
  const LINE_GAP = 2;
  const fontMin = 16;
  const ref = rows.reduce((a, b) => (a.length >= b.length ? a : b), "");
  let fontSize = 72;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  while (fontSize > fontMin) {
    ctx.font = `900 ${fontSize}px Arial`;
    const maxLineW = Math.max(...rows.map((line) => ctx.measureText(line).width));
    const blockTextH = fontSize * rows.length + LINE_GAP * (rows.length - 1);
    if (maxLineW <= maxWidth && blockTextH <= blockH) break;
    fontSize -= 1;
  }
  ctx.fillStyle = "#000000";
  const lineStep = fontSize + LINE_GAP;
  const totalH = lineStep * rows.length - LINE_GAP;
  const firstY = blockTop + Math.floor((blockH - totalH) / 2 + fontSize / 2);
  rows.forEach((line, i) => {
    ctx.fillText(line, centerX, firstY + i * lineStep);
  });
}

/** Tray sticker on 50×25 mm — QR fills height, small gap, text tight (not location rack/shelf layout). */
function drawTrayLabelOnCanvas(ctx, canvas, img, data) {
  const marginPx = Math.round(1 * PX_PER_MM);
  const gapPx = Math.round(1 * PX_PER_MM);
  const baseWidth = LABEL_W_MM * PX_PER_MM;
  const baseHeight = LABEL_H_MM * PX_PER_MM;
  const innerW = baseWidth - marginPx * 2;
  const innerH = baseHeight - marginPx * 2;

  let qrSize = innerH;
  let textW = innerW - qrSize - gapPx;
  const minTextW = Math.floor(innerW * 0.32);
  if (textW < minTextW) {
    textW = minTextW;
    qrSize = Math.max(48, innerW - textW - gapPx);
  }

  const qrX = marginPx;
  const qrY = marginPx + Math.floor((innerH - qrSize) / 2);
  const textX = marginPx + qrSize + gapPx;
  const textCenterX = textX + Math.floor(textW / 2);

  canvas.width = baseWidth;
  canvas.height = baseHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, baseWidth, baseHeight);
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  const trayLines = Array.isArray(data?.label_lines) ? data.label_lines.slice(0, 2) : [];
  if (trayLines.length >= 2) {
    drawCompactTrayTextBlock(ctx, trayLines, textCenterX, marginPx, innerH, textW);
  } else {
    const fallback = String(data?.location_no || "").trim().toUpperCase();
    if (fallback) {
      drawCompactTrayTextBlock(ctx, [fallback], textCenterX, marginPx, innerH, textW);
    }
  }
}

export function getLocationDisplayNo(data) {
  return (
    data?.location_no ||
    `${data?.rack_no || ""}${(data?.shelf_no || "").toString().toUpperCase()}` ||
    "—"
  );
}

function drawLabelOnCanvas(ctx, canvas, img, data) {
  const trayLines = Array.isArray(data?.label_lines) ? data.label_lines : null;
  if (trayLines?.length >= 2) {
    drawTrayLabelOnCanvas(ctx, canvas, img, data);
    return;
  }

  const scale = 1;
  const baseWidth = LABEL_W_MM * PX_PER_MM;
  const baseHeight = LABEL_H_MM * PX_PER_MM;
  const rackShelf = `${data?.rack_no || ""}${(data?.shelf_no || "").toString().toUpperCase()}` || "__";

  const contentWidth = Math.floor(baseWidth * CONTENT_W_RATIO);
  const contentHeight = Math.floor(baseHeight * CONTENT_H_RATIO);
  const contentX = Math.floor((baseWidth - contentWidth) / 2);
  const contentY = Math.floor((baseHeight - contentHeight) / 2);
  const leftColWidth = Math.floor((contentWidth - COL_GAP) * QR_COLUMN_RATIO);
  const rightColWidth = contentWidth - COL_GAP - leftColWidth;
  const qrSize = Math.max(
    48,
    Math.min(leftColWidth - INNER_GAP_X * 2, contentHeight - INNER_GAP_Y * 2)
  );
  const leftColX = contentX;
  const leftColY = contentY;
  const rightColX = contentX + leftColWidth + COL_GAP;
  const rightColY = contentY;
  const qrX = leftColX + Math.floor((leftColWidth - qrSize) / 2);
  const qrY = leftColY + Math.floor((contentHeight - qrSize) / 2);
  const textCenterX = rightColX + Math.floor(rightColWidth / 2);
  const textCenterY = rightColY + Math.floor(contentHeight / 2);

  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, baseWidth, baseHeight);
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  const maxTextWidth = rightColWidth - INNER_GAP_X * 2;
  const maxTextHeight = contentHeight - INNER_GAP_Y * 2;
  let fontSize = 54;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  while (fontSize > 18) {
    ctx.font = `bold ${fontSize}px Arial`;
    if (ctx.measureText(rackShelf).width <= maxTextWidth && fontSize <= maxTextHeight) break;
    fontSize -= 1;
  }
  ctx.fillStyle = "#000000";
  ctx.fillText(rackShelf, textCenterX, textCenterY);
}


/** Build label PNG from a rendered QR <svg> element (single drawer preview). */
export function buildLocationLabelDataUrlFromSvg(svgElement, data) {
  requireLocationQrValue(data);
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        drawLabelOnCanvas(ctx, canvas, img, data);
        resolve(canvas.toDataURL("image/png", 1.0));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load QR image"));
    };
    img.src = url;
  });
}

/** Build label PNG for one location row (bulk — no DOM ref). */
export async function buildLocationLabelDataUrlFromRow(data) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const qrValue = getQrEncodeValue(data);
  const svgMarkup = renderToStaticMarkup(
    React.createElement(QRCode, { value: qrValue, size: QR_SOURCE_PX, level: "H" })
  );
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        drawLabelOnCanvas(ctx, canvas, img, data);
        resolve(canvas.toDataURL("image/png", 1.0));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render QR label"));
    };
    img.src = url;
  });
}

export async function buildLocationLabelDataUrlsForRows(rows) {
  const out = [];
  for (const row of rows) {
    out.push(await buildLocationLabelDataUrlFromRow(row));
  }
  return out;
}

/** @returns {boolean} false if the browser blocked the print pop-up */
export function printLocationLabelDataUrls(dataUrls) {
  if (!dataUrls?.length) return false;
  const printWin = window.open("", "", "width=500,height=600");
  if (!printWin) return false;
  printWin.document.write(
    buildQrLabelPrintDocumentHtml(dataUrls, qrLabelPrintCssMm(QR_LABEL_PRINT.locationAndMachineMm))
  );
  printWin.document.close();
  return true;
}

export function downloadLocationLabelDataUrl(data, dataUrl) {
  const link = document.createElement("a");
  link.download = `LOC_${data?.location_id ?? "label"}.png`;
  link.href = dataUrl;
  link.click();
}

export async function downloadLocationLabelDataUrls(rows) {
  for (let i = 0; i < rows.length; i++) {
    const dataUrl = await buildLocationLabelDataUrlFromRow(rows[i]);
    downloadLocationLabelDataUrl(rows[i], dataUrl);
    if (i < rows.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}
