"use client";

import AttendanceLogThumb from "@/apps/hrms/modules/attendance-log/AttendanceLogThumb";

function Row({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">{label}</div>
      <div className="mt-0.5 text-xs font-bold normal-case text-slate-700 break-words leading-snug">{value || "—"}</div>
    </div>
  );
}

export default function AttendanceLogCard({ row, onOpen }) {
  return (
    <div className="grid h-full min-h-[11rem] grid-cols-2">
      <AttendanceLogThumb row={row} onClick={onOpen} variant="card" />
      <div className="min-w-0 space-y-2 p-3 pr-8">
        <Row label="Emp Code" value={row?.employee_code} />
        <Row label="Name" value={row?.name} />
        <Row label="Date & Time" value={row?.event_datetime_display || row?.event_timestamp} />
        <Row label="Auth Method" value={row?.auth_method} />
      </div>
    </div>
  );
}
