export function normalizeAccCode(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s === "" || s === "-" ? null : s;
}

export function effectiveBoxCustomerAcc(overrideCust, packingAccCode) {
  const override = normalizeAccCode(overrideCust);
  const packing = normalizeAccCode(packingAccCode);
  if (!override) return packing;
  if (packing && override === packing) return packing;
  return override;
}

export function isBoxCustomerOverridden(overrideCust, packingAccCode) {
  const override = normalizeAccCode(overrideCust);
  const packing = normalizeAccCode(packingAccCode);
  return !!override && override !== packing;
}
