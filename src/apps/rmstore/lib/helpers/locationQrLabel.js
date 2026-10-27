import React from "react";
import QRCode from "react-qr-code";
import { formatLocationDisplay, getLocationStoredNo } from "@/apps/rmstore/lib/helpers/formatLocationDisplay";
/**
 * RM Store location QR sticker — change RM print width×height here (inch).
 * IMS Tray uses ims/locationQrLabel.js (50×25 mm) — not this RM inch sticker.
 *
 * marginMm, gapMm, minTextShare, qrSourcePx, fontMinPx — layout tuning (not paper size).
 */
export const RM_LOCATION_LABEL = {
  widthIn: 5.9,
  heightIn: 3.8,
  marginMm: 5,
  gapMm: 6,
  minTextShare: 0.50,
  qrSourcePx: 768,
  fontMinPx: 80,
};

const PX_PER_MM = 12;

function labelPageCss(label) {
  const pageW = `${label.widthIn}in`;
  const pageH = `${label.heightIn}in`;
  return { pageW, pageH, pageSize: `${pageW} ${pageH}` };
}

function labelCanvasPx(label) {
  const labelWMm = label.widthIn * 25.4;
  const labelHMm = label.heightIn * 25.4;
  return {
    baseWidth: Math.round(labelWMm * PX_PER_MM),
    baseHeight: Math.round(labelHMm * PX_PER_MM),
  };
}

export function rmLocationLabelSizeText() {
  const { widthIn, heightIn } = RM_LOCATION_LABEL;
  return `${widthIn}×${heightIn} in`;
}

export function getLocationQrValue(data) {
  const row = data?.row_no || data?.shelf_no || "";
  return (
    data?.location_no ||
    (data?.rack_no ? `RM-${data.rack_no}${String(row).toUpperCase()}` : "") ||
    ""
  )
    .toString()
    .trim()
    .toUpperCase();
}

function requireLocationQrValue(data) {
  const value = getLocationQrValue(data);
  if (!value) {
    throw new Error("The location code is missing. Enter a location number or an RM rack and row.");
  }
  return value;
}

/** QR image payload — optional `qr_value` (e.g. tray public URL); label text still uses location_no. */
function getQrEncodeValue(data) {
  const custom = String(data?.qr_value ?? "").trim();
  if (custom) return custom;
  return requireLocationQrValue(data);
}

export function getLocationDisplayNo(data) {
  const display = formatLocationDisplay(data);
  return display || "—";
}

function getPrintedLocationText(data) {
  const display = getLocationDisplayNo(data);
  return display === "—" ? "__" : display;
}

export { getLocationStoredNo, formatLocationDisplay };

function fitFontSize(ctx, text, maxWidth, maxHeight, fontMinPx) {
  const fontMin = fontMinPx;
  let lo = fontMin;
  let hi = Math.max(fontMin, Math.floor(maxHeight));
  let best = fontMin;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `900 ${mid}px Arial`;
    const width = ctx.measureText(text).width;
    if (width <= maxWidth && mid <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function drawCenteredTextBlock(ctx, lines, centerX, blockTop, blockH, maxWidth, fontMinPx) {
  const rows = (lines || []).map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!rows.length) return;
  const rowH = Math.floor(blockH / rows.length);
  const ref = rows.reduce((a, b) => (a.length >= b.length ? a : b), "");
  const fontSize = fitFontSize(ctx, ref, maxWidth, Math.max(8, rowH - 2), fontMinPx);
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  rows.forEach((line, i) => {
    const y = blockTop + Math.floor(rowH * i + rowH / 2);
    ctx.fillText(line, centerX, y);
  });
}

function drawLabelOnCanvas(ctx, canvas, img, data, label = RM_LOCATION_LABEL) {
  const { marginMm, gapMm, minTextShare, fontMinPx } = label;
  const { baseWidth, baseHeight } = labelCanvasPx(label);
  const rackRow = getPrintedLocationText(data);
  const safe = Math.round(marginMm * PX_PER_MM);
  const gap = Math.round(gapMm * PX_PER_MM);

  const innerX = safe;
  const innerY = safe;
  const innerW = baseWidth - safe * 2;
  const innerH = baseHeight - safe * 2;

  let qrSize = innerH;
  let textW = innerW - qrSize - gap;
  const minTextW = Math.floor(innerW * minTextShare);
  if (textW < minTextW) {
    textW = minTextW;
    qrSize = innerW - textW - gap;
  }

  const qrX = innerX;
  const qrY = innerY + Math.floor((innerH - qrSize) / 2);
  const textX = innerX + qrSize + gap;
  const textY = innerY;

  canvas.width = baseWidth;
  canvas.height = baseHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, baseWidth, baseHeight);
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  const textCenterX = textX + Math.floor(textW / 2);
  const trayLines = Array.isArray(data?.label_lines) ? data.label_lines : null;
  if (trayLines?.length >= 2) {
    drawCenteredTextBlock(ctx, trayLines.slice(0, 2), textCenterX, textY, innerH, textW, fontMinPx);
  } else {
    const fontSize = fitFontSize(ctx, rackRow, textW, innerH, fontMinPx);
    ctx.font = `900 ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000000";
    ctx.fillText(rackRow, textCenterX, textY + Math.floor(innerH / 2));
  }
}

/** Build label PNG from a rendered QR <svg> element (single drawer preview). */
export function buildLocationLabelDataUrlFromSvg(svgElement, data, label = RM_LOCATION_LABEL) {
  getQrEncodeValue(data);
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
        drawLabelOnCanvas(ctx, canvas, img, data, label);
        resolve(canvas.toDataURL("image/png", 1.0));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load the QR image. Please try again."));
    };
    img.src = url;
  });
}

/** Build label PNG for one location row (bulk — no DOM ref). */
export async function buildLocationLabelDataUrlFromRow(data, label = RM_LOCATION_LABEL) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const qrValue = getQrEncodeValue(data);
  const svgMarkup = renderToStaticMarkup(
    React.createElement(QRCode, { value: qrValue, size: label.qrSourcePx, level: "H" })
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
        drawLabelOnCanvas(ctx, canvas, img, data, label);
        resolve(canvas.toDataURL("image/png", 1.0));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not generate the QR label. Please try again."));
    };
    img.src = url;
  });
}

export async function buildLocationLabelDataUrlsForRows(rows, label = RM_LOCATION_LABEL) {
  const out = [];
  for (const row of rows) {
    out.push(await buildLocationLabelDataUrlFromRow(row, label));
  }
  return out;
}

/** @returns {boolean} false if the browser blocked the print pop-up */
export function printLocationLabelDataUrls(dataUrls, label = RM_LOCATION_LABEL) {
  if (!dataUrls?.length) return false;
  const { pageW, pageH, pageSize } = labelPageCss(label);
  const pages = dataUrls
    .map(
      (url) =>
        `<div class="label-page"><div class="label"><img src="${url}" alt=""></div></div>`
    )
    .join("");
  const printWin = window.open("", "", "width=500,height=600");
  if (!printWin) return false;
  printWin.document.write(`
    <html>
      <head>
        <style>
          @page { size: ${pageSize}; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          .label-page {
            width: ${pageW};
            height: ${pageH};
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
          }
          .label-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .label {
            width: ${pageW};
            height: ${pageH};
            display: block;
            box-sizing: border-box;
            overflow: hidden;
          }
          .label img {
            width: ${pageW};
            height: ${pageH};
            display: block;
            object-fit: contain;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        </style>
      </head>
      <body>
        ${pages}
        <script>
          (function () {
            var printed = false;
            function go() {
              if (printed) return;
              printed = true;
              window.focus();
              window.print();
              window.close();
            }
            function wait() {
              var imgs = Array.prototype.slice.call(document.images || []);
              var pending = imgs.filter(function (img) { return !img.complete; });
              if (!pending.length) {
                setTimeout(go, 50);
                return;
              }
              var left = pending.length;
              pending.forEach(function (img) {
                img.onload = img.onerror = function () {
                  left -= 1;
                  if (left <= 0) setTimeout(go, 50);
                };
              });
            }
            if (document.readyState === "complete") wait();
            else window.onload = wait;
          })();
        </script>
      </body>
    </html>
  `);
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
