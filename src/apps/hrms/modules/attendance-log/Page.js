"use client";

import { useCallback, useRef } from "react";
import { ScrollText } from "lucide-react";
import { toast } from "react-toastify";
import { attendanceLogService } from "@/apps/hrms/lib/services/hrms";
import { ATTENDANCE_LOG_HEADERS } from "@/apps/hrms/lib/columns/attendanceLogColumns";
import ServerListPage from "@/ui/common/list/ServerListPage";
import ActionButton from "@/ui/primitives/ActionButton";
import { LIST_PAGE_PRIMARY_ACTION } from "@/ui/common/list/listPageCrud";

export default function AttendanceLogPage() {
  const reloadRef = useRef(null);

  const handleSync = useCallback(async (range = {}) => {
    try {
      console.log("[HRMS SYNC] start", range);
      const res = await attendanceLogService.sync(range);
      console.log("[HRMS SYNC] response", res);
      toast.success(res?.message || "Attendance sync completed.");
      reloadRef.current?.();
    } catch (err) {
      console.error("[HRMS SYNC] failed", err);
      toast.error(err?.message || "Attendance sync failed.");
    }
  }, []);

  return (
    <ServerListPage
      emptyIcon={ScrollText}
      fetchList={attendanceLogService.list}
      headers={ATTENDANCE_LOG_HEADERS}
      getRowId={(row) => row.id}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        return (
          <ActionButton
            module="hrms_attendance_log"
            action="view"
            label="Sync"
            onClick={() =>
              handleSync({
                from: api.params?.fromDate || "",
                to: api.params?.toDate || "",
              })
            }
            className={LIST_PAGE_PRIMARY_ACTION}
          />
        );
      }}
    />
  );
}
