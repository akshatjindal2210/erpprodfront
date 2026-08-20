import { toast } from "react-toastify";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import { coilService } from "@/apps/rmstore/lib/services/coil";
import { coilHelperContext } from "@/apps/rmstore/lib/helpers/coilLookup";

function normalizeCoilUid(coil_no_uid) {
  let targetUid = String(coil_no_uid || "").trim();
  if (!targetUid) return "";
  if (targetUid.includes(",")) targetUid = targetUid.split(",")[0].trim();
  return targetUid;
}

/**
 * Open QC / coil report on the same page via hidden iframe print preview
 * (same pattern as IMS Forwarding Note → Print Bill).
 */
export async function printCoilReport({ coil_no_uid, permissionModule = "rm_coils", printing, setPrinting }) {
  const targetUid = normalizeCoilUid(coil_no_uid);
  if (!targetUid) {
    toast.info("Select a record with a valid coil UID to print.");
    return;
  }
  if (printing) return;
  setPrinting?.(true);
  try {
    const res = await coilService.finderReport({
      coil_no_uid: targetUid,
      ...coilHelperContext(permissionModule, "view"),
    });
    if (!res?.success || !res?.html) {
      throw new Error(res?.message || "Report HTML missing");
    }
    const ok = printFromBackendHtml(res.html, { title: res.print_title });
    if (!ok) throw new Error("Could not open print preview. Try again.");
  } catch (err) {
    toast.error(err?.message || "Failed to generate report.");
  } finally {
    setPrinting?.(false);
  }
}
