import { hrmsApproveCell, hrmsCountCell, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

export const ATTENDANCE_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date", "attendance_date_display", hrmsDateCell, { width: "100px" }],
  ["Shift", "shift_display", hrmsEmpty, { width: "80px" }],
  ["In Time", "in_display", hrmsTimeCell, { width: "155px" }],
  ["Out Time", "out_display", hrmsMutedTimeCell, { width: "155px" }],
  ["Punches", "punch_count", hrmsCountCell, { width: "80px", align: "center" }],
  ["Type", "entry_type_display", hrmsEmpty, { width: "90px" }],
  ["Approval", "approval_status_display", hrmsApproveCell, { width: "100px" }],
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];