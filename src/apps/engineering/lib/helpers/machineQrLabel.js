import { QR_LABEL_PRINT, buildQrLabelPrintDocumentHtml, qrLabelPrintCssMm } from "@/platform/config/qrLabelPrintSize.config";

/** Machine label layout — paper mm → platform/config/qrLabelPrintSize.config.js */
const LABEL_W_MM = QR_LABEL_PRINT.locationAndMachineMm.widthMm;
const LABEL_H_MM = QR_LABEL_PRINT.locationAndMachineMm.heightMm;
const PX_PER_MM = 12;
const CONTENT_W_RATIO = 0.92;
const CONTENT_H_RATIO = 0.82;
const QR_COLUMN_RATIO = 0.58;
const COL_GAP = 6;
const INNER_GAP_X = 6;
const INNER_GAP_Y = 6;
const QR_SOURCE_PX = 256;

export function getMachineDisplayNo(data) {
  return String(data?.macno || "").trim() || "—";
}

/** Encoded QR string — prefer API `qr_value` (public URL), else plain machine number. */
export function getMachineQrValue(data) {
  return String(data?.qr_value || data?.macno || "")
    .toString()
    .trim();
}

function requireMachineQrValue(data) {
  const value = getMachineQrValue(data);
  if (!value) throw new Error("Machine number is missing.");
  return value;
}

function drawLabelOnCanvas(ctx, canvas, img, data) {
  const scale = 1;
  const baseWidth = LABEL_W_MM * PX_PER_MM;
  const baseHeight = LABEL_H_MM * PX_PER_MM;
  const labelText = getMachineDisplayNo(data) === "—" ? "__" : getMachineDisplayNo(data);

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
  const rightColX = contentX + leftColWidth + COL_GAP;
  const rightColY = contentY;
  const qrX = leftColX + Math.floor((leftColWidth - qrSize) / 2);
  const qrY = contentY + Math.floor((contentHeight - qrSize) / 2);
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
    if (ctx.measureText(labelText).width <= maxTextWidth && fontSize <= maxTextHeight) break;
    fontSize -= 1;
  }
  ctx.fillStyle = "#000000";
  ctx.fillText(labelText, textCenterX, textCenterY);
}

/** Build label PNG from a rendered QR <svg> (drawer preview). */
export function buildMachineLabelDataUrlFromSvg(svgElement, data) {
  requireMachineQrValue(data);
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

/** @returns {boolean} false if the browser blocked the print pop-up */
export function printMachineLabelDataUrls(dataUrls) {
  if (!dataUrls?.length) return false;
  const printWin = window.open("", "", "width=500,height=600");
  if (!printWin) return false;
  printWin.document.write(
    buildQrLabelPrintDocumentHtml(dataUrls, qrLabelPrintCssMm(QR_LABEL_PRINT.locationAndMachineMm))
  );
  printWin.document.close();
  return true;
}

export function downloadMachineLabelDataUrl(data, dataUrl) {
  const slug = String(data?.macno || data?.maccode || "label").replace(/[^\w.-]+/g, "_");
  const link = document.createElement("a");
  link.download = `MACHINE_${slug}.png`;
  link.href = dataUrl;
  link.click();
}
