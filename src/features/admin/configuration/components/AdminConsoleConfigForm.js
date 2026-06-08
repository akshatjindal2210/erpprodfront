"use client";

import { AppConfigFormFooter, AppConfigFormLoading, ConfigFieldRows } from "@/features/admin/configuration/components/AppConfigFormFields";
import { useAppConfigForm } from "@/features/admin/configuration/hooks/useAppConfigForm";

const COMPANY_LAYOUT = [
  ["company_name", "company_phone", "company_email"],
  ["company_pincode", "company_state", "company_gstin"],
  ["company_address"],
];

export default function AdminConsoleConfigForm() {
  const { loading, saving, draft, setDraft, dirtyRows, rowsBySection, handleReset, handleSubmit } =
    useAppConfigForm("admin-console");

  const companyByKey = rowsBySection("company");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <AppConfigFormLoading />
        ) : (
          <div className="w-full">
            <section>
              <div className="mb-4 pb-2 border-b border-slate-200">
                <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Company details</h2>
                <p className="text-[10px] text-slate-500 mt-1">
                  Global organisation profile — applies across all apps (e.g. printed on box stickers).
                </p>
              </div>
              <ConfigFieldRows
                layout={COMPANY_LAYOUT}
                rowsByKey={companyByKey}
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
