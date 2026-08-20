"use client";

import { ListTodo } from "lucide-react";

import { AppConfigFormFooter, AppConfigFormLoading, ConfigFieldRows } from "@/apps/settings/configuration/components/AppConfigFormFields";
import { useAppConfigForm } from "@/apps/settings/configuration/hooks/useAppConfigForm";

/** Shared Settings form — layout comes from each app's app.config.js */
export default function AppConfigScopedForm({ config }) {
  const appId = config?.appId;
  const sections = config?.sections || [];
  const emptyMessage = config?.emptyMessage;

  const { loading, saving, draft, setDraft, dirtyRows, rowsBySection, handleReset, handleSubmit } =
    useAppConfigForm(appId);

  if (!sections.length && emptyMessage) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[320px] p-8 text-center bg-slate-50/40">
        <div className="w-14 h-14 rounded-none bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
          <ListTodo size={28} className="text-slate-500" />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">{emptyMessage.title}</h2>
        <p className="text-[11px] text-slate-500 mt-2 max-w-sm leading-relaxed">{emptyMessage.description}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-8">
        {loading ? (
          <AppConfigFormLoading />
        ) : (
          <div className="w-full space-y-8">
            {sections.map((section) => (
              <section key={section.id}>
                <div className="mb-4 pb-2 border-b border-slate-200">
                  <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
                    {section.title}
                  </h2>
                  {section.description ? (
                    <p className="text-[10px] text-slate-500 mt-1">{section.description}</p>
                  ) : null}
                </div>
                <ConfigFieldRows
                  layout={section.layout}
                  rowsByKey={rowsBySection(section.id)}
                  draft={draft}
                  setDraft={setDraft}
                  disabled={saving}
                />
              </section>
            ))}
          </div>
        )}
      </div>

      {!loading && sections.length > 0 && (
        <AppConfigFormFooter saving={saving} dirtyCount={dirtyRows.length} onReset={handleReset} />
      )}
    </form>
  );
}
