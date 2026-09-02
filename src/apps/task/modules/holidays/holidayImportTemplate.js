import writeXlsxFile from "write-excel-file/browser";

export async function downloadHolidayImportTemplate() {
  const rows = [
    ["name", "date"],
    ["Republic Day", "2026-01-26"],
    ["Holi", "2026-03-14"],
    ["Independence Day", "2026-08-15"],
  ];
  const blob = await writeXlsxFile(rows, { dateFormat: "dd/mm/yyyy" }).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "holiday-import-format.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
