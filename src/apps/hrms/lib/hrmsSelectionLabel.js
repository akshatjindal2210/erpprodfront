function t(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

/** Footer “Selected: …” — use on ServerListPage / ClientListPage: selectionLabel={hrmsSelectionLabel.attendance} */
export const hrmsSelectionLabel = {
  attendance: (r) => `Selected: ${t(r?.emp_code || r?.emp_dcode)} | ${t(r?.name)} | ${t(r?.attendance_date_display || r?.attendance_date)}`,
  employee: (r) => `Selected: ${t(r?.emp_code)} | ${t(r?.emp_name)}`,
  gatePass: (r) => `Selected: ${t(r?.emp_code)} | ${t(r?.emp_name)} | ${t(r?.pass_date_display || r?.pass_date)}`,
  attendanceLog: (r) => `Selected: ${t(r?.employee_code)} | ${t(r?.name)} | ${t(r?.event_datetime_display || r?.event_timestamp)}`,
};
