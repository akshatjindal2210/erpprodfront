import { hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsStatusCell, hrmsTimeCell } from "./hrmsListCells";

function cellText(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

function eventDateText(row) {
  return row?.event_datetime_display ?? row?.event_timestamp ?? "—";
}

function createdAtText(row) {
  return row?.created_at_display ?? row?.created_at ?? "—";
}

export const ATTENDANCE_LOG_HEADERS = [
  [
    "ID",
    "id",
    (v) => <span className="font-mono text-[10px] font-bold text-slate-500">{v ?? "—"}</span>,
    { width: "70px", copyValue: (row) => cellText(row?.id) },
  ],
  [
    "Emp Code",
    "employee_code",
    hrmsEmpCodeCell,
    { fixed: true, width: "100px", copyValue: (row) => cellText(row?.employee_code) },
  ],
  [
    "Name",
    "name",
    hrmsNameCell,
    { width: "140px", copyValue: (row) => cellText(row?.name) },
  ],
  [
    "Date & Time",
    "event_timestamp",
    (_, row) => hrmsTimeCell(eventDateText(row)),
    { width: "150px", copyValue: (row) => eventDateText(row) },
  ],
  [
    "Status",
    "status",
    hrmsStatusCell,
    { width: "170px", copyValue: (row) => cellText(row?.status) },
  ],
  [
    "Auth Method",
    "auth_method",
    hrmsEmpty,
    { width: "140px", copyValue: (row) => cellText(row?.auth_method) },
  ],
  [
    "Sub Event",
    "sub_event_type",
    hrmsEmpty,
    { width: "90px", copyValue: (row) => cellText(row?.sub_event_type) },
  ],
  [
    "Event Name",
    "event_name",
    hrmsEmpty,
    { width: "180px", wrap: true, copyValue: (row) => cellText(row?.event_name) },
  ],
  [
    "Card Reader",
    "card_reader_no",
    hrmsEmpty,
    { width: "100px", copyValue: (row) => cellText(row?.card_reader_no) },
  ],
  [
    "Created At",
    "created_at",
    (_, row) => hrmsMutedTimeCell(createdAtText(row)),
    { width: "140px", copyValue: (row) => createdAtText(row) },
  ],
];
