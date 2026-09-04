"use client";

import { ScrollText } from "lucide-react";
import { attendanceLogService } from "@/apps/hrms/lib/services/hrms";
import { ATTENDANCE_LOG_HEADERS } from "@/apps/hrms/lib/columns/attendanceLogColumns";
import ServerListPage from "@/ui/common/list/ServerListPage";

export default function AttendanceLogPage() {
  return (
    <ServerListPage
      emptyIcon={ScrollText}
      fetchList={attendanceLogService.list}
      headers={ATTENDANCE_LOG_HEADERS}
      getRowId={(row) => row.id}
    />
  );
}
