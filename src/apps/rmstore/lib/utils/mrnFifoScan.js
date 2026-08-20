/** MRN that may receive the next scan (FIFO). null = all quotas filled. */
export function nextAllowedMrnUid(orderedQuotas, scannedCoils) {
  const scannedByMrn = new Map();
  for (const c of scannedCoils || []) {
    const k = String(c?.mrn_uid || "").trim();
    if (k) scannedByMrn.set(k, (scannedByMrn.get(k) || 0) + 1);
  }
  for (const q of orderedQuotas || []) {
    const k = String(q.mrn_uid || "").trim();
    const need = Number(q.count) || 0;
    const got = scannedByMrn.get(k) || 0;
    if (got < need) return k;
  }
  return null;
}

export function canAddCoilForMrnFifo(orderedQuotas, scannedCoils, newCoil) {
  const allowedMrn = nextAllowedMrnUid(orderedQuotas, scannedCoils);
  if (!allowedMrn) {
    return { ok: false, message: "All required MRN quotas are already scanned." };
  }
  const coilMrn = String(newCoil?.mrn_uid || "").trim();
  if (coilMrn !== allowedMrn) {
    const q = (orderedQuotas || []).find((x) => String(x.mrn_uid).trim() === allowedMrn);
    return {
      ok: false,
      message: `Scan MRN ${q?.mrn_no || allowedMrn} first (FIFO). This coil is from MRN ${newCoil?.mrn_no || coilMrn}.`,
    };
  }
  return { ok: true };
}

export function assertMrnScanFifoOrder(orderedQuotas, scannedCoilsInOrder) {
  const quotas = (orderedQuotas || []).map((q) => ({
    muid: String(q.mrn_uid || "").trim(),
    need: Number(q.count) || 0,
    mrn_no: q.mrn_no,
  }));
  const scannedByMrn = new Map();
  let activeIdx = 0;

  for (const coil of scannedCoilsInOrder || []) {
    const muid = String(coil?.mrn_uid || "").trim();
    const qIndex = quotas.findIndex((q) => q.muid === muid);
    if (qIndex < 0) {
      return {
        ok: false,
        message: `Coil ${coil?.coil_no_uid || ""} is not from a reserved MRN.`,
      };
    }
    if (qIndex > activeIdx) {
      const expected = quotas[activeIdx];
      return {
        ok: false,
        message: `MRN FIFO: complete MRN ${expected?.mrn_no || expected?.muid} before MRN ${quotas[qIndex]?.mrn_no || muid}.`,
      };
    }
    scannedByMrn.set(muid, (scannedByMrn.get(muid) || 0) + 1);
    while (activeIdx < quotas.length) {
      const q = quotas[activeIdx];
      if ((scannedByMrn.get(q.muid) || 0) >= q.need) activeIdx += 1;
      else break;
    }
  }
  return { ok: true };
}
