/**
 * Platform — QR / label PRINT paper width × height ONLY.
 * Change sizes here; layout / font / QR sharpness stay in each module’s *QrLabel.js.
 *
 * | Key                   | Used by |
 * |-----------------------|---------|
 * | locationAndMachineMm  | IMS Tray QR, Location QR, Engineering Machine QR |
 * | rmCoilStickerMm       | RM MRN coil / QC sticker (preview; backend coilStickerDesign.js for HTML print) |
 *
 * RM Store location print size → rmstore/locationQrLabel.js (`RM_LOCATION_LABEL`).
 */

export const QR_LABEL_PRINT = {
  locationAndMachineMm: { widthMm: 50, heightMm: 25 },
  rmCoilStickerMm: { widthMm: 65, heightMm: 85 },
};

export function qrLabelPrintSizeTextIn({ widthIn, heightIn }) {
  return `${widthIn}×${heightIn} in`;
}

export function qrLabelPrintSizeTextMm({ widthMm, heightMm }) {
  return `${widthMm}×${heightMm} mm`;
}

/** @page size + label box (millimetres). */
export function qrLabelPrintCssMm({ widthMm, heightMm }) {
  return {
    pageSize: `${widthMm}mm ${heightMm}mm`,
    width: `${widthMm}mm`,
    height: `${heightMm}mm`,
  };
}

/** @page size + label box (inches). */
export function qrLabelPrintCssIn({ widthIn, heightIn }) {
  return {
    pageSize: `${widthIn}in ${heightIn}in`,
    width: `${widthIn}in`,
    height: `${heightIn}in`,
  };
}

/** Shared print window HTML for PNG label pages. */
export function buildQrLabelPrintDocumentHtml(dataUrls, sizeCss) {
  const { pageSize, width, height } = sizeCss;
  const pages = (dataUrls || [])
    .map((url) => `<div class="label-page"><div class="label"><img src="${url}" alt=""></div></div>`)
    .join("");
  return `
    <html>
      <head>
        <style>
          @page { size: ${pageSize}; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          .label-page {
            width: ${width};
            height: ${height};
            page-break-after: always;
            overflow: hidden;
          }
          .label-page:last-child { page-break-after: auto; }
          .label {
            width: ${width};
            height: ${height};
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
  `;
}
