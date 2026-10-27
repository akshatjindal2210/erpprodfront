/**
 * IMS Tray Master — print width×height (mm). Not RM Store location sticker.
 * Default: same as IMS Location / Machine QR (50×25 mm).
 */
import { QR_LABEL_PRINT, qrLabelPrintSizeTextMm } from "@/platform/config/qrLabelPrintSize.config";

export const TRAY_QR_PRINT_MM = QR_LABEL_PRINT.locationAndMachineMm;

export function trayQrLabelSizeText() {
  return qrLabelPrintSizeTextMm(TRAY_QR_PRINT_MM);
}
