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

export default function AttendanceLogCard({ row, onPhotoClick }) {
  return (
    <div className="grid h-full min-h-[11rem] grid-cols-2">
      <div
        className="min-h-[11rem]"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <AttendanceLogThumb row={row} onClick={onPhotoClick} variant="card" />
      </div>
      <div className="min-w-0 space-y-2 p-3 pr-8 pointer-events-none">
        <Row label="Emp Code" value={row?.employee_code} />
        <Row label="Name" value={row?.name} />
        <Row label="Date & Time" value={row?.event_datetime_display || row?.event_timestamp} />
        <Row label="Auth Method" value={row?.auth_method} />
      </div>
    </div>
  );
}
