export const isManageTraySourceBlocked = (row) =>
  String(row?.source || "").trim().toUpperCase() === "MANAGE TRAY";

export function isManageTrayApproved(row) {
  return row?.approved === true || row?.approved === "true" || row?.approved === 1;
}

export function isManageTrayDraft(row) {
  return Boolean(row) && !isManageTrayApproved(row);
}

export function isManageTrayInProgress(row) {
  if (!isManageTrayDraft(row)) return false;
  return (Number(row?.link_count) || 0) > 0;
}

export function isManageTrayInUse(row) {
  return (Number(row?.used_count) || 0) > 0;
}

export function isManageTrayReady(row) {
  if (!isManageTrayDraft(row)) return false;
  return (Number(row?.link_count) || 0) <= 0;
}

export function manageTrayLinkProgress(row) {
  const linked = Number(row?.link_count) || 0;
  const required = Number(row?.box_count) || 0;
  return { linked, required, complete: required > 0 && linked >= required };
}

export function manageTrayProgressLabel(row) {
  const { linked, required } = manageTrayLinkProgress(row);
  if (!required && !linked) return null;
  return `${linked}/${required || "?"}`;
}

export function manageTrayStatusMeta(row) {
  if (isManageTrayApproved(row)) {
    return {
      label: "REGISTERED",
      className: "bg-emerald-50 text-emerald-600 border-emerald-100",
      progress: manageTrayProgressLabel(row),
    };
  }
  if (isManageTrayInProgress(row)) {
    return {
      label: "DRAFT",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      progress: manageTrayProgressLabel(row),
    };
  }
  return {
    label: "PENDING",
    className: "bg-indigo-50 text-indigo-600 border-indigo-100",
    progress: manageTrayProgressLabel(row),
  };
}
