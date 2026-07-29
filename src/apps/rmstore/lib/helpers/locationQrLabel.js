import React from "react";
import QRCode from "react-qr-code";

const LABEL_W_MM = 50;
const LABEL_H_MM = 25;
const PX_PER_MM = 12;

/**
 * Label layout tuning (50×25 mm) — change ONLY here; Print QR + Bulk QR both use this file.
 * Bigger QR: raise QR_COLUMN_RATIO, CONTENT_H_RATIO; lower INNER_GAP_* / COL_GAP.
 * Smaller QR: lower QR_COLUMN_RATIO; more gap if needed.
 */
const CONTENT_W_RATIO = 0.92;   // usable width on label (0.88–0.95)
const CONTENT_H_RATIO = 0.82;   // usable height — higher = taller QR (0.74–0.88)
const QR_COLUMN_RATIO = 0.58;   // left side % for QR vs rack/row text (0.48–0.65)
const COL_GAP = 6;              // gap between QR block and text block
const INNER_GAP_X = 6;          // padding inside QR column
const INNER_GAP_Y = 6;          // padding inside QR column (height limit)
const QR_SOURCE_PX = 256;       // QR render sharpness (200–320); not visual size on label

export function getLocationQrValue(data) {
  return (
    data?.location_no ||
    (data?.rack_no ? `RM-${data.rack_no}${(data?.row_no || "").toString().toUpperCase()}` : "") ||
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

export function getLocationDisplayNo(data) {
  return (
    data?.location_no ||
    (data?.rack_no ? `RM-${data.rack_no}${(data?.row_no || "").toString().toUpperCase()}` : "") ||
    "—"
  );
}

function drawLabelOnCanvas(ctx, canvas, img, data) {
  const scale = 1;
  const baseWidth = LABEL_W_MM * PX_PER_MM;
  const baseHeight = LABEL_H_MM * PX_PER_MM;
  const rackRow = getLocationDisplayNo(data) === "—" ? "__" : getLocationDisplayNo(data);

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
    if (ctx.measureText(rackRow).width <= maxTextWidth && fontSize <= maxTextHeight) break;
    fontSize -= 1;
  }
  ctx.fillStyle = "#000000";
  ctx.fillText(rackRow, textCenterX, textCenterY);
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
      reject(new Error("Could not load the QR image. Please try again."));
    };
    img.src = url;
  });
}

/** Build label PNG for one location row (bulk — no DOM ref). */
export async function buildLocationLabelDataUrlFromRow(data) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const qrValue = requireLocationQrValue(data);
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
      reject(new Error("Could not generate the QR label. Please try again."));
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
          @page { size: 50mm 25mm; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          .label-page {
            width: 50mm;
            height: 25mm;
            page-break-after: always;
            overflow: hidden;
          }
          .label-page:last-child { page-break-after: auto; }
          .label {
            width: 50mm;
            height: 25mm;
            display: block;
            box-sizing: border-box;
          }
          .label img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: fill;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        </style>
      </head>
      <body onload="setTimeout(() => { window.print(); window.close(); }, 250)">
        ${pages}
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
