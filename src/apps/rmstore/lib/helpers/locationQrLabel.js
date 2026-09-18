import React from "react";
import QRCode from "react-qr-code";

/**
 * RM location QR sticker — change size / QR / font ONLY here.
 * Print QR + Bulk QR both use this. Do not hardcode sizes anywhere else.
 *
 * widthIn / heightIn  → paper size (IMS packing sticker is 5.9 × 3.8 in)
 * marginMm            → white edge (raise if the printer clips the QR)
 * gapMm               → space between QR and location text
 * minTextShare        → minimum % of inner width kept for the code (0.36–0.55)
 * qrSourcePx          → QR sharpness only, not printed size
 * fontMinPx           → smallest location-code font
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
const LABEL_W_MM = RM_LOCATION_LABEL.widthIn * 25.4;
const LABEL_H_MM = RM_LOCATION_LABEL.heightIn * 25.4;
const PAGE_W = `${RM_LOCATION_LABEL.widthIn}in`;
const PAGE_H = `${RM_LOCATION_LABEL.heightIn}in`;

export function rmLocationLabelSizeText() {
  return `${RM_LOCATION_LABEL.widthIn}×${RM_LOCATION_LABEL.heightIn} in`;
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

export function getLocationDisplayNo(data) {
  const row = data?.row_no || data?.shelf_no || "";
  return (
    data?.location_no ||
    (data?.rack_no ? `RM-${data.rack_no}${String(row).toUpperCase()}` : "") ||
    "—"
  );
}

function getPrintedLocationText(data) {
  const row = (data?.row_no || data?.shelf_no || "").toString().toUpperCase();
  const rackRow = `${data?.rack_no || ""}${row}`.trim();
  if (rackRow) return rackRow;
  const display = getLocationDisplayNo(data);
  return display === "—" ? "__" : display;
}

function fitFontSize(ctx, text, maxWidth, maxHeight) {
  const fontMin = RM_LOCATION_LABEL.fontMinPx;
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

function drawLabelOnCanvas(ctx, canvas, img, data) {
  const { marginMm, gapMm, minTextShare } = RM_LOCATION_LABEL;
  const baseWidth = Math.round(LABEL_W_MM * PX_PER_MM);
  const baseHeight = Math.round(LABEL_H_MM * PX_PER_MM);
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

  const fontSize = fitFontSize(ctx, rackRow, textW, innerH);
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  ctx.fillText(rackRow, textX + Math.floor(textW / 2), textY + Math.floor(innerH / 2));
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
    React.createElement(QRCode, { value: qrValue, size: RM_LOCATION_LABEL.qrSourcePx, level: "H" })
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
          @page { size: ${PAGE_W} ${PAGE_H}; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          .label-page {
            width: ${PAGE_W};
            height: ${PAGE_H};
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
            width: ${PAGE_W};
            height: ${PAGE_H};
            display: block;
            box-sizing: border-box;
            overflow: hidden;
          }
          .label img {
            width: ${PAGE_W};
            height: ${PAGE_H};
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
