import { labelStickerDownloadSource } from "@/platform/utils/global";
import { applyClientSearch } from "@/ui/common/list/clientListSearch";

/** Fields searched on sticker download log list (client-side only). */
export function stickerLogSearchParts(row) {
  const source = row?.download_source;
  return [
    row?.primary_label,
    row?.box_uid,
    row?.packing_number,
    row?.acc_name,
    row?.itemdcode,
    row?.last_downloaded_by_name,
    source,
    source ? labelStickerDownloadSource(source) : null,
  ];
}

export function filterStickerDownloadLogs(rows, query, options = {}) {
  return applyClientSearch(rows, query, { getParts: stickerLogSearchParts, ...options });
}
