"use client";

import { useCallback, useRef, useState } from "react";
import { ImageOff, Loader2, RefreshCw, ScrollText } from "lucide-react";
import { toast } from "react-toastify";

import { attendanceLogService } from "@/apps/hrms/lib/services/hrms";
import { attendanceLogHeaders } from "@/apps/hrms/lib/columns/attendanceLogColumns";
import { fetchAttendanceLogImage, peekAttendanceLogImage } from "@/apps/hrms/lib/attendanceLogImage";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageDeleteButton, ListPageViewButton, LIST_PAGE_PRIMARY_ACTION } from "@/ui/common/list/listPageCrud";
import ActionButton from "@/ui/primitives/ActionButton";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
const MODULE = "hrms_attendance_log";

export default function AttendanceLogPage() {
  const reloadRef = useRef(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [proxyImageUrl, setProxyImageUrl] = useState("");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async (range = {}) => {
    setSyncing(true);
    const toastId = toast.loading("Syncing from device…");
    try {
      const res = await attendanceLogService.sync(range);
      const n = Number(res?.total);
      const message =
        res?.message || (Number.isFinite(n) && n > 0 ? `Synced ${n} new log(s).` : "No new logs.");
      toast.update(toastId, { render: message, type: "success", isLoading: false, autoClose: 3500 });
      reloadRef.current?.();
    } catch (err) {
      toast.update(toastId, {
        render: err?.message || "Sync failed.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setSyncing(false);
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
      const result = peekAttendanceLogImage(record) || (await fetchAttendanceLogImage(record));
      setProxyImageUrl(result.proxyUrl || "");
      setSourceImageUrl(result.sourceUrl || "");
      if (result.displayUrl) setImageUrl(result.displayUrl);
      else setImageError("Image not found.");
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
        headers={attendanceLogHeaders(openView)}
        initialSort={{ sortKey: "event_timestamp", sortDir: "desc" }}
        moduleName="Attendance Log"
        viewModule={MODULE}
        getRowId={(row) => row.id}
        cardConfig={{
          titleKey: "photo",
          // Commnet for future point will use ok
          // badgeIndices: ["status"],
          // detailKeys: ["employee_code", "name", "event_timestamp", "auth_method", "sub_event_type", "event_name", "card_reader_no"],
          // footerKey: "id",
        }}
        searchPlaceholder="Code, name, status, event, reader…"
        clientQuickSearch
        onRowDoubleClick={openView}
        selectionLabel={hrmsSelectionLabel.attendanceLog}
        toolbarActions={(api) => {
          reloadRef.current = api.reload;
          const selected = api.selectedRecord;
          return (
            <>
              <ActionButton
                module={MODULE}
                action="add"
                label={syncing ? "Syncing…" : "Sync"}
                icon={syncing ? Loader2 : RefreshCw}
                disabled={syncing}
                onClick={() =>
                  handleSync({
                    from: api.params?.fromDate || "",
                    to: api.params?.toDate || "",
                  })
                }
                className={`${LIST_PAGE_PRIMARY_ACTION}${syncing ? " [&>svg]:animate-spin" : ""}`}
              />
              <ListPageViewButton
                module={MODULE}
                disabled={!selected || syncing}
                record={selected}
                onClick={() => openView(selected)}
              />
              <ListPageDeleteButton module={MODULE} disabled={!selected || syncing} onClick={() => setDeleteItem(selected)} />
            </>
          );
        }}
      />
      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => reloadRef.current?.()}
        service={attendanceLogService}
        entityLabel="Attendance log"
        idKey="id"
        titleKey="employee_code"
        moduleSlug={MODULE}
        warningMessage="This log will be hidden and will not come back on sync."
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
            <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 min-h-[12rem] flex items-center justify-center">
              <img
                src={imageUrl}
                alt="Attendance event"
                className="w-full max-h-[65vh] object-contain rounded-md bg-white opacity-0 transition-opacity duration-200 data-[loaded=true]:opacity-100"
                onLoad={(e) => {
                  e.currentTarget.dataset.loaded = "true";
                }}
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
