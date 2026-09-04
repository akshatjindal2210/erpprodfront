import { hrmsApproveCell, hrmsEmpCodeCell, hrmsEmpty, hrmsNameCell, hrmsTimeCell } from "./hrmsListCells";

/** ERP employee master — table columns (display fields only). */
export const EMPLOYEE_HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "emp_name", hrmsNameCell, { width: "160px" }],
  ["Department", "deptname", hrmsEmpty, { width: "160px" }],
  ["Branch", "brcode", hrmsEmpty, { width: "80px" }],
  ["In Time", "emp_intime_display", hrmsTimeCell, { width: "90px" }],
  ["Out Time", "emp_outtime_display", hrmsTimeCell, { width: "90px" }],
  ["Status", "pauthorise", hrmsApproveCell, { width: "110px" }],
  ["OT Allow", "ot_allow", hrmsEmpty, { width: "80px" }],
];

/** Detail modal — all mapped fields (no raw ERP duplicates). */
export const EMPLOYEE_DETAIL_FIELDS = [
  ["Emp Code", "emp_code"],
  ["Name", "emp_name"],
  ["Father Name", "emp_fname"],
  ["Emp Dcode", "emp_dcode"],
  ["Dept", "deptcode"],
  ["Department", "deptname"],
  ["Branch", "brcode"],
  ["In Time", "emp_intime_display"],
  ["Out Time", "emp_outtime_display"],
  ["Lunch In", "emp_lintime_display"],
  ["Lunch Out", "emp_louttime_display"],
  ["Calc OT Alw1", "calc_ot_alw1"],
  ["OT Alw2 Less", "ot_alw2_less"],
  ["Lrd Code", "lrdcode"],
  ["OT Allow", "ot_allow"],
  ["Status", "pauthorise"],
  ["Authorise", "authorise"],
  ["Stop OT Sun", "stop_ot_calc_except_sund"],
];

export const EMPLOYEE_LABELS = Object.fromEntries(
  EMPLOYEE_DETAIL_FIELDS.map(([label, key]) => [key, label])
);
