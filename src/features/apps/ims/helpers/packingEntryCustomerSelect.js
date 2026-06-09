import { masterService } from "@/features/apps/ims/services/master";

/** Resolve ledger for dropdown — display acc_name only; acc_code stays internal id. */
export function fetchItemScopedLedgerById(id, perms, nameFallbackRow = null) {
  return masterService.getLedgerViewById(id, perms).then((res) => {
    const data = res?.data;
    if (data?.acc_name != null && String(data.acc_name).trim() !== "") {
      return res;
    }
    const acc = nameFallbackRow?.acc_code;
    const name = nameFallbackRow?.acc_name;
    if (acc != null && String(id) === String(acc) && String(name ?? "").trim() !== "") {
      return {
        ...res,
        success: true,
        data: {
          id: acc,
          acc_code: acc,
          acc_name: String(name).trim(),
        },
      };
    }
    return res;
  });
}
