import writeXlsxFile from "write-excel-file/browser";

export async function downloadShortageImportTemplate() {
  const rows = [
    [17876, "B034TW(72/132)", 1180],
    [19540, "HW032", 50000],
    [18889, "FN047D", 1000],
  ];
  const blob = await writeXlsxFile(rows, { dateFormat: "dd/mm/yyyy" }).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "shortage-import-format.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
