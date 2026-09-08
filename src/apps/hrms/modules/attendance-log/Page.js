"use client";

import { useCallback, useRef, useState } from "react";
import { ImageOff, Loader2, ScrollText } from "lucide-react";
import { toast } from "react-toastify";
import { attendanceLogService } from "@/apps/hrms/lib/services/hrms";
import { ATTENDANCE_LOG_HEADERS } from "@/apps/hrms/lib/columns/attendanceLogColumns";
import { API_BASE_URL } from "@/platform/utils/core/lib";
import ServerListPage from "@/ui/common/list/ServerListPage";
import ActionButton from "@/ui/primitives/ActionButton";
import { LIST_PAGE_PRIMARY_ACTION } from "@/ui/common/list/listPageCrud";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";

export default function AttendanceLogPage() {
  const reloadRef = useRef(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [proxyImageUrl, setProxyImageUrl] = useState("");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  const handleSync = useCallback(async (range = {}) => {
    try {
      const res = await attendanceLogService.sync(range);
      toast.success(res?.message || "Done.");
      reloadRef.current?.();
    } catch (err) {
      toast.error(err?.message || "Sync failed.");
    }
  }, []);

  const openView = useCallback(async (record) => {
    if (!record) return;
    setViewRecord(record);
    setViewOpen(true);
    setLoadingImage(true);
    setImageUrl("");
    setProxyImageUrl("");
    setSourceImageUrl("");
    setImageError("");
    try {
      const res = await attendanceLogService.image({
        employee_code: record.employee_code,
        event_timestamp: record.event_timestamp,
        sub_event_type: record.sub_event_type,
        image_url: record.image_url || "",
        source_image_url: record.source_image_url || "",
      });
      const dataUrl = String(res?.data?.image_data_url ?? "").trim();
      const rawProxyUrl = String(res?.data?.image_proxy_url ?? res?.data?.image_url ?? "").trim();
      const proxyUrl = rawProxyUrl && !/^https?:\/\//i.test(rawProxyUrl) ? `${API_BASE_URL}${rawProxyUrl}` : rawProxyUrl;
      const originalUrl = String(res?.data?.source_image_url ?? "").trim();
      setProxyImageUrl(proxyUrl);
      setSourceImageUrl(originalUrl);
      if (dataUrl) setImageUrl(dataUrl);
      else if (proxyUrl) setImageUrl(proxyUrl);
      else if (originalUrl) setImageUrl(originalUrl);
      else setImageError(res?.message || "Image not found.");
    } catch (err) {
      setImageError(err?.message || "Image load failed.");
    } finally {
      setLoadingImage(false);
    }
  }, []);

  return (
    <>
      <ServerListPage
        emptyIcon={ScrollText}
        fetchList={attendanceLogService.list}
        headers={ATTENDANCE_LOG_HEADERS}
        getRowId={(row) => row.id}
        toolbarActions={(api) => {
          reloadRef.current = api.reload;
          return (
            <>
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
              <ActionButton
                module="hrms_attendance_log"
                action="view"
                label="View"
                disabled={!api.selectedRecord}
                onClick={() => openView(api.selectedRecord)}
                className={LIST_PAGE_PRIMARY_ACTION}
              />
            </>
          );
        }}
      />
      <GlobalDetailModal
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewRecord(null);
          setImageUrl("");
          setProxyImageUrl("");
          setSourceImageUrl("");
          setImageError("");
        }}
        title="Attendance Log Image"
        icon={ScrollText}
        size="extra-wide"
      >
        <div className="space-y-3">
          <div className="text-xs text-slate-600 font-medium">
            {viewRecord ? `${viewRecord.employee_code || "—"} | ${viewRecord.name || "—"} | ${viewRecord.event_datetime_display || "—"}` : ""}
          </div>
          {loadingImage ? (
            <div className="h-64 border border-slate-200 rounded-lg flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading image...</span>
            </div>
          ) : imageUrl ? (
            <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
              <img
                src={imageUrl}
                alt="Attendance event"
                className="w-full max-h-[65vh] object-contain rounded-md bg-white"
                onError={() => {
                  if (proxyImageUrl && imageUrl !== proxyImageUrl) {
                    setImageUrl(proxyImageUrl);
                    return;
                  }
                  if (sourceImageUrl && imageUrl !== sourceImageUrl) {
                    setImageUrl(sourceImageUrl);
                    return;
                  }
                  setImageUrl("");
                  setImageError("Image not available.");
                }}
              />
            </div>
          ) : (
            <div className="h-64 border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500">
              <ImageOff className="h-6 w-6" />
              <span className="text-sm">{imageError || "Image not available."}</span>
            </div>
          )}
        </div>
      </GlobalDetailModal>
    </>
  );
}
