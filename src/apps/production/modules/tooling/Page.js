"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Wrench, RefreshCcw, CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "react-toastify";

import ToolingTab from "@/apps/production/modules/tooling/ToolingTab";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import ActionButton from "@/ui/primitives/ActionButton";
import { ListPageDeleteButton } from "@/ui/common/list/listPageCrud";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

const TOOLING_PAGE_TABS = [
  { id: "register", label: "Register", icon: CheckCircle2 },
  { id: "pending", label: "Pending", icon: ClipboardList },
];

const DEFAULT_PAGE_TAB = "pending";

export default function ToolingPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("production_tooling", "view"), [canAccess]);
  const [viewMode, handleViewMode] = useViewMode();
  const [pageTab, setPageTab] = useState(DEFAULT_PAGE_TAB);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toolingOpened, setToolingOpened] = useState(DEFAULT_PAGE_TAB === "pending");
  const toolingTabRef = useRef(null);
  const [toolingSelection, setToolingSelection] = useState(null);
  const [registerSelection, setRegisterSelection] = useState(null);
  const registerTabRef = useRef(null);
  const [toolingData, setToolingData] = useState({ rows: [], headers: [] });

  const isPendingTab = pageTab === "pending";
  const isRegisterTab = pageTab === "register";

  const refreshAll = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPendingTab ? "Tooling Pending" : "Tooling Register",
    rows: toolingData.rows,
    headers: toolingData.headers,
  });

  if (!viewAccess.allowed) {
    return <div className="p-8 text-sm text-slate-500">You do not have permission to view Tooling.</div>;
  }

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={(id) => {
                  setPageTab(id);
                  setToolingOpened(true);
                  setToolingSelection(null);
                  setRegisterSelection(null);
                  refreshAll();
                }}
                tabs={TOOLING_PAGE_TABS}
              />
            }
            actions={
              <>
                {isPendingTab ? (
                  <ActionButton
                    module="production_tooling"
                    action="authorize"
                    variant="outline"
                    label="Accept"
                    icon={Wrench}
                    disabled={!toolingSelection}
                    onClick={() => toolingTabRef.current?.openAction()}
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                  />
                ) : null}
                {isRegisterTab ? (
                  <ListPageDeleteButton
                    module="production_tooling"
                    disabled={!registerSelection}
                    onClick={() => {
                      if (!registerSelection) return toast.info("Select a register row to delete.");
                      registerTabRef.current?.openDelete();
                    }}
                  />
                ) : null}
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={refreshAll}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0"
                >
                  <RefreshCcw size={14} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={exportDisabled}
                onExport={handleExport}
              />
            }
          />
        </ListPageToolbar>

        {toolingOpened ? (
          <div className={isPendingTab ? "contents" : "hidden"}>
            <ToolingTab
              ref={toolingTabRef}
              surface="pending"
              refreshKey={refreshKey}
              active={isPendingTab}
              viewMode={viewMode}
              onDataChange={isPendingTab ? setToolingData : undefined}
              onSelectionChange={isPendingTab ? setToolingSelection : undefined}
            />
          </div>
        ) : null}
        {toolingOpened ? (
          <div className={isRegisterTab ? "contents" : "hidden"}>
            <ToolingTab
              ref={registerTabRef}
              surface="register"
              refreshKey={refreshKey}
              active={isRegisterTab}
              viewMode={viewMode}
              onDataChange={isRegisterTab ? setToolingData : undefined}
              onSelectionChange={isRegisterTab ? setRegisterSelection : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
