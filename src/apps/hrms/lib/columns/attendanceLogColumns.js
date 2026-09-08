import { hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsStatusCell, hrmsTimeCell } from "./hrmsListCells";

export const ATTENDANCE_LOG_HEADERS = [
  ["ID", "id", (v) => <span className="font-mono text-slate-500 text-[10px]">{v ?? "—"}</span>, { width: "70px" }],
  ["Emp Code", "employee_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date & Time", "event_datetime_display", hrmsTimeCell, { width: "150px" }],
  ["Status", "status", hrmsStatusCell, { width: "110px" }],
  ["Auth Method", "auth_method", hrmsEmpty, { width: "140px" }],
  ["Sub Event", "sub_event_type", hrmsEmpty, { width: "90px" }],
  ["Event Name", "event_name", hrmsEmpty, { width: "180px", wrap: true }],
  ["Card Reader", "card_reader_no", hrmsEmpty, { width: "100px" }],
  ["Created At", "created_at_display", hrmsMutedTimeCell, { width: "140px" }],
];
