/** In-process rejection — only coils still in possession (store or shop floor). */

import { isIssuedToShopFloor, isSaMinusWriteOff } from "@/apps/rmstore/lib/utils/saMinusInventory";

export function isCoilEligibleForIprRejection(coil, { editIprUid = null } = {}) {
  if (!coil?.coil_no_uid) return false;
  if (coil.rm_uid != null && String(coil.rm_uid).trim() !== "") return false;

  const status = String(coil.status || "active").toLowerCase();
  const coilIpr = coil.ipr_uid != null ? Number(coil.ipr_uid) : null;
  const editIpr = editIprUid != null ? Number(editIprUid) : null;

  if (status === "returned") return false;
  if (status === "consumed" || isSaMinusWriteOff(coil)) return false;

  if (status === "rejected") {
    if (editIpr && coilIpr === editIpr) return true;
    return false;
  }

  if (status === "out") return isIssuedToShopFloor(coil);
  return status === "active";
}

export function iprRejectionIneligibleMessage(coil) {
  const uid = coil?.coil_no_uid || "unknown";
  if (coil?.rm_uid) {
    return `Coil ${uid} is already on rejection register #${coil.rm_uid}.`;
  }
  const status = String(coil?.status || "active").toLowerCase();
  if (status === "returned") {
    return `Coil ${uid} was already returned to the supplier and cannot be rejected again.`;
  }
  if (isSaMinusWriteOff(coil)) {
    return `Coil ${uid} was removed by stock adjustment and is no longer in inventory.`;
  }
  if (status === "consumed") {
    return `Coil ${uid} was fully consumed and is no longer in your possession.`;
  }
  if (status === "rejected" && coil?.ipr_uid) {
    return `Coil ${uid} is already held for in-process rejection #${coil.ipr_uid}.`;
  }
  return `Coil ${uid} is not available for rejection. Its current status is ${status}.`;
}

export function iprRejectionPendingStoreInMessage(coil) {
  const uid = coil?.coil_no_uid || "unknown";
  const iprUid = coil?.pending_store_in_ipr_uid;
  if (iprUid == null || String(iprUid).trim() === "") return null;
  return `Coil ${uid} is queued in Store In Pending (IPR #${iprUid}). Receive or cancel that store-in before rejecting this coil.`;
}

export async function findRejectionCoilsBlockedByPendingStoreIn(coils = [], lookupCoilByUid, coilCtx) {
  const blocked = [];
  for (const c of coils || []) {
    const uid = String(c?.coil_no_uid || "").trim();
    if (!uid) continue;
    let pendingUid = c?.pending_store_in_ipr_uid;
    if (pendingUid == null && typeof lookupCoilByUid === "function") {
      try {
        const detail = await lookupCoilByUid(uid, coilCtx);
        pendingUid = detail?.pending_store_in_ipr_uid;
      } catch {
        /* skip */
      }
    }
    if (pendingUid != null && String(pendingUid).trim() !== "") {
      blocked.push({
        coil_no_uid: uid,
        pending_store_in_ipr_uid: pendingUid,
        message: iprRejectionPendingStoreInMessage({ coil_no_uid: uid, pending_store_in_ipr_uid: pendingUid }),
      });
    }
  }
  return blocked;
}

export async function filterCoilsForRejectionLot(coils = [], lookupCoilByUid, coilCtx) {
  const blocked = await findRejectionCoilsBlockedByPendingStoreIn(coils, lookupCoilByUid, coilCtx);
  if (!blocked.length) {
    return { kept: coils, blocked: [] };
  }
  const blockedSet = new Set(blocked.map((b) => String(b.coil_no_uid).toLowerCase()));
  const kept = (coils || []).filter(
    (c) => c?.coil_no_uid && !blockedSet.has(String(c.coil_no_uid).toLowerCase())
  );
  return { kept, blocked };
}
