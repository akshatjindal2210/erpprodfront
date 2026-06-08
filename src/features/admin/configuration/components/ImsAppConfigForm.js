"use client";

import {
  AppConfigFormFooter,
  AppConfigFormLoading,
  ConfigFieldRows,
} from "@/features/admin/configuration/components/AppConfigFormFields";
import { useAppConfigForm } from "@/features/admin/configuration/hooks/useAppConfigForm";

const APPLICATION_LAYOUT = [
  ["inward_location_validation", "default_list_view_span_days"],
  ["box_qr_public_base_url"],
];

export default function ImsAppConfigForm() {
  const { loading, saving, draft, setDraft, dirtyRows, rowsBySection, handleReset, handleSubmit } =
    useAppConfigForm("ims");

  const applicationByKey = rowsBySection("application");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <AppConfigFormLoading />
        ) : (
          <div className="w-full">
            <section>
              <div className="mb-4 pb-2 border-b border-slate-200">
                <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Application settings</h2>
                <p className="text-[10px] text-slate-500 mt-1">IMS-only behaviour for all users.</p>
              </div>
              <ConfigFieldRows
                layout={APPLICATION_LAYOUT}
                rowsByKey={applicationByKey}
                draft={draft}
                setDraft={setDraft}
                disabled={saving}
              />
            </section>
          </div>
        )}
      </div>

      {!loading && (
        <AppConfigFormFooter saving={saving} dirtyCount={dirtyRows.length} onReset={handleReset} />
      )}
    </form>
  );
}
