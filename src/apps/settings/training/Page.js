"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Video, Plus, Check } from "lucide-react";
import { toast } from "react-toastify";

import { settingsModuleService as moduleService } from "@/apps/settings/lib/services/moduleService";
import { trainingVideoService, moduleSopService } from "@/apps/settings/lib/services/trainingService";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { PERMS } from "@/ui/common/Constants";

import DataTable from "@/ui/primitives/DataTable";
import EmptyState from "@/ui/common/table/EmptyState";
import ViewToggle from "@/ui/primitives/ViewToggle";
import VideoModal from "./VideoModal";
import SopModal from "./SopModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { applyClientSearch, sortRowsByKey, fetchAllListPages } from "@/platform/utils/list/listSearch";
import { APP_TYPE_LABELS } from "@/config/moduleAppRegistry";

function SopCell({ sop, onClick, disabled = false, isTable = false }) {
  const baseTone = sop
    ? "bg-violet-50 border-violet-200 text-violet-800 hover:border-violet-400"
    : "bg-slate-50 border-dashed border-slate-300 text-slate-400 hover:border-slate-500 hover:text-slate-600 hover:bg-white";

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        flex flex-col items-center justify-center transition-all duration-200 border rounded-none
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        ${isTable ? "h-10 min-w-[4.5rem] max-w-[5.5rem] mx-auto" : "h-12 w-full"}
        ${baseTone}
      `}
    >
      {sop ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
      <span className="text-[9px] font-bold uppercase tracking-tighter mt-0.5">SOP</span>
    </div>
  );
}

function PermissionCell({ video, perm, onClick, disabled = false, isTable = false }) {
  const baseTone = video
    ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400"
    : "bg-slate-50 border-dashed border-slate-300 text-slate-400 hover:border-slate-500 hover:text-slate-600 hover:bg-white";

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        flex flex-col items-center justify-center transition-all duration-200 border rounded-none
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        ${isTable ? "h-10 min-w-[4.5rem] max-w-[5.5rem] mx-auto" : "h-12 w-full"}
        ${baseTone}
      `}
    >
      {video ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
      <span className="text-[9px] font-bold uppercase tracking-tighter mt-0.5">{perm}</span>
    </div>
  );
}

function ModuleCard({ mod, perms, getVideo, getSop, onVideoClick, onSopClick, disabledVideoActions, sopCellDisabled }) {
  return (
    <div className="bg-white border border-slate-300 rounded-none p-4 hover:border-slate-400 transition-all flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight truncate">{mod.label || mod.name}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
          mod.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          {mod.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="mt-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {perms.map((p) => (
          <div key={p} className="flex flex-col gap-1 min-w-0">
            <PermissionCell
              perm={p}
              video={getVideo(mod.id, p)}
              disabled={disabledVideoActions}
              onClick={() => onVideoClick(mod, p)}
            />
            <SopCell
              sop={getSop(mod.id, p)}
              disabled={sopCellDisabled(mod.id, p)}
              onClick={() => onSopClick(mod, p)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const canAccess = useCanAccess();
  const canViewTraining = useMemo(() => canAccess("training_videos", "view").allowed, [canAccess]);
  const canAddTraining = useMemo(() => canAccess("training_videos", "add").allowed, [canAccess]);
  const canEditTraining = useMemo(() => canAccess("training_videos", "edit").allowed, [canAccess]);
  const canDeleteTraining = useMemo(() => canAccess("training_videos", "delete").allowed, [canAccess]);

  const [allModules, setAllModules] = useState([]);
  const [videos, setVideos] = useState([]);
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  /** Client-only: column sort. Server reload only via Refresh (same as Users / Modules). */
  const [params, setParams] = useState({
    pageSize: 500,
    appType: "all",
    sortKey: null,
    sortDir: "asc",
  });

  const [tempSearch, setTempSearch] = useState("");
  const [displayLimit, setDisplayLimit] = useState(50);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedSopSlot, setSelectedSopSlot] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setBlockedMessage("");
      const perPage = Math.min(Math.max(1, params.pageSize), 1000);
      const { data } = await fetchAllListPages(
        async (page, limit) => {
          const body = await moduleService.getViews({
            page,
            limit,
            sortBy: "sort_order",
            order: "ASC",
            permission_module: "training_videos",
            permission_action: "view",
          });
          const list = body?.data ?? [];
          const rows = Array.isArray(list) ? list : [];
          const t = Number(body?.total ?? 0);
          return { data: rows, total: Number.isFinite(t) ? t : rows.length };
        },
        perPage,
        50000
      );

      const vidRes = await trainingVideoService.getAll({
        permission_module: "training_videos",
        permission_action: "view",
      });

      let sopRows = [];
      try {
        const sopRes = await moduleSopService.getAll({
          permission_module: "training_videos",
          permission_action: "view",
          page: 1,
          limit: 10000,
          filters: {},
        });
        sopRows = sopRes.data || [];
      } catch (sopErr) {
        console.warn("training SOP list failed", sopErr);
        sopRows = [];
      }

      setAllModules(data);
      setVideos(vidRes.data || []);
      setSops(sopRows);
      setDisplayLimit(50);
    } catch (err) {
      const msg = err?.message || "";
      const denied =
        err?.status === 403 &&
        (msg.includes("Access Denied — module") || msg.toLowerCase().includes("deactivated"));
      if (denied) {
        setAllModules([]);
        setVideos([]);
        setSops([]);
        setBlockedMessage(msg);
      } else {
        toast.error(err?.message || "Failed to load training data");
      }
    } finally {
      setLoading(false);
    }
  }, [params.pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSorted = useMemo(() => {
    let rows = [...allModules];

    if (params.appType && params.appType !== "all") {
      const typeKey = String(params.appType).trim().toLowerCase();
      rows = rows.filter((r) => String(r.app_type ?? "").trim().toLowerCase() === typeKey);
    }

    const q = String(tempSearch || "").trim();
    let data = rows;
    if (q) {
      data = applyClientSearch(rows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allModules, tempSearch, params.sortKey, params.sortDir, params.appType]);

  const visibleModules = useMemo(
    () => filteredSorted.slice(0, displayLimit),
    [filteredSorted, displayLimit]
  );

  const totalLoaded = allModules.length;
  const filteredCount = filteredSorted.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && visibleModules.length < filteredCount) {
      setDisplayLimit((n) => n + 50);
    }
  }, [loading, visibleModules.length, filteredCount]);

  const getVideo = (modId, perm) => videos.find(v => v.module_id === modId && v.permission_type === perm);
  const getSop = (modId, perm) => sops.find(s => s.module_id === modId && s.permission_type === perm);

  const sopCellDisabled = useCallback(
    (modId, perm) => {
      const existing = getSop(modId, perm);
      if (existing) return false;
      return !canAddTraining;
    },
    [sops, canAddTraining]
  );

  const handleBoxClick = (mod, perm) => {
    const existing = getVideo(mod.id, perm);
    if (existing) {
      if (!canEditTraining) {
        toast.error("You do not have permission to open this training video.");
        return;
      }
    } else if (!canAddTraining) {
      toast.error("You do not have permission to add training videos.");
      return;
    }
    setSelectedSlot({
      modId: mod.id,
      perm,
      modLabel: mod.label,
      isEdit: !!existing,
      id: existing?.id,
      existingData: existing,
      canAdd: canAddTraining,
      canEdit: canEditTraining,
      canDelete: canDeleteTraining,
      sopDef: getSop(mod.id, perm) || null,
    });
  };

  const handleSopBoxClick = (mod, perm) => {
    const existing = getSop(mod.id, perm);
    if (existing) {
      if (canEditTraining) {
        setSelectedSopSlot({
          modId: mod.id,
          perm,
          modLabel: mod.label,
          isEdit: true,
          id: existing.id,
          existingData: existing,
          canAdd: canAddTraining,
          canEdit: canEditTraining,
          canDelete: canDeleteTraining,
          viewOnly: false,
        });
      } else if (canViewTraining) {
        setSelectedSopSlot({
          modId: mod.id,
          perm,
          modLabel: mod.label,
          isEdit: true,
          id: existing.id,
          existingData: existing,
          canAdd: canAddTraining,
          canEdit: canEditTraining,
          canDelete: canDeleteTraining,
          viewOnly: true,
        });
      } else {
        toast.error("You do not have permission to view this SOP.");
      }
      return;
    }
    if (!canAddTraining) {
      toast.error("You do not have permission to add SOPs.");
      return;
    }
    setSelectedSopSlot({
      modId: mod.id,
      perm,
      modLabel: mod.label,
      isEdit: false,
      canAdd: canAddTraining,
      canEdit: canEditTraining,
      canDelete: canDeleteTraining,
      viewOnly: false,
    });
  };

  const disabledPermissionCells = !canAddTraining && !canEditTraining;

  const appTypeFilterOptions = useMemo(() => {
    const knownOrder = ["core", "ims", "task"];
    const types = [
      ...new Set(
        allModules
          .map((r) => String(r.app_type ?? "").trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    types.sort((a, b) => {
      const ia = knownOrder.indexOf(a);
      const ib = knownOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return [
      { label: "All Apps", value: "all" },
      ...types.map((t) => ({
        label: APP_TYPE_LABELS[t] ?? t.toUpperCase(),
        value: t,
      })),
    ];
  }, [allModules]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      appType: data.appType || "all",
    }));
    setDisplayLimit(50);
  };

  const handleReset = () => {
    setTempSearch("");
    setParams((prev) => ({ ...prev, appType: "all" }));
    setDisplayLimit(50);
  };

  const extraFilters = useMemo(
    () => [
      {
        label: "App",
        key: "appType",
        value: params.appType,
        options: appTypeFilterOptions,
      },
    ],
    [params.appType, appTypeFilterOptions]
  );

  const HEADERS = [
    ["Module Details", "label", (v, row) => (
      <div className="flex flex-col py-1">
        <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight">{v}</span>
        {/* <span className="text-[10px] text-slate-400 font-medium italic">{row.name}</span> */}
      </div>
    ), { width: "200px", wrap: true }],
    ...PERMS.map(p => [
      p.toUpperCase(),
      null,
      (v, row) => (
        <div className="flex flex-col items-center justify-center gap-1 py-1 px-0.5">
          <PermissionCell
            isTable
            perm={p}
            video={getVideo(row.id, p)}
            disabled={disabledPermissionCells}
            onClick={() => handleBoxClick(row, p)}
          />
          <SopCell
            isTable
            sop={getSop(row.id, p)}
            disabled={sopCellDisabled(row.id, p)}
            onClick={() => handleSopBoxClick(row, p)}
          />
        </div>
      ),
      { align: "center", width: "112px" },
    ]),
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">

        <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button type="button" onClick={() => fetchData()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none shrink-0">
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9 shrink-0" />
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            instantClientExtras
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Module name or label…"
            searchLabel="Quick filter"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          {viewMode === "table" ? (
            <DataTable
              viewMode="table"
              headers={HEADERS}
              data={visibleModules}
              loading={loading}
              sortKey={params.sortKey}
              sortDir={params.sortDir}
              showSelection={false}
              onSort={(key) => {
                setDisplayLimit(50);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              emptyIcon={Video}
              emptyMessage={blockedMessage || "No training data found"}
              emptySubMessage={blockedMessage ? "No records are available for the current selection." : undefined}
              onLoadMore={handleLoadMore}
              hasMore={displayLimit < filteredCount}
              totalItems={filteredCount}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              {loading && allModules.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <div key={i} className="h-44 bg-slate-50 animate-pulse rounded-none border border-slate-200" />)}
                </div>
              ) : filteredSorted.length === 0 ? (
                <EmptyState
                  isTable={false}
                  icon={Video}
                  message={blockedMessage || "No training data found"}
                  subMessage={blockedMessage ? "No records are available for the current selection." : undefined}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visibleModules.map((mod) => (
                      <div key={mod.id}>
                        <ModuleCard
                          mod={mod}
                          perms={PERMS}
                          getVideo={getVideo}
                          getSop={getSop}
                          onVideoClick={handleBoxClick}
                          onSopClick={handleSopBoxClick}
                          disabledVideoActions={disabledPermissionCells}
                          sopCellDisabled={sopCellDisabled}
                        />
                      </div>
                    ))}
                  </div>
                  {displayLimit < filteredCount && (
                    <div className="flex justify-center py-4">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="h-9 px-6 text-[11px] font-bold uppercase tracking-wider border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none disabled:opacity-50"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                  {loading && allModules.length > 0 && (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {String(tempSearch || "").trim()
              ? `${filteredCount} match · ${totalLoaded} loaded`
              : `Showing ${visibleModules.length} of ${filteredCount} modules`}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {selectedSlot && (
        <VideoModal slot={selectedSlot} onClose={() => setSelectedSlot(null)} onSuccess={() => { fetchData(); setSelectedSlot(null); }} />
      )}
      {selectedSopSlot && (
        <SopModal
          slot={selectedSopSlot}
          onClose={() => setSelectedSopSlot(null)}
          onSuccess={() => {
            fetchData();
            setSelectedSopSlot(null);
          }}
        />
      )}
    </div>
  );
}

