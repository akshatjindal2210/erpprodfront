"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, FileText, History, Loader2, Printer } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import FilePreviewLink, { downloadFileInPlace } from "@/ui/common/system/FilePreviewLink";
import { buildQcSummary, coilHasQcLink, coilJourneyKey, fetchCoilFinderData, qcDocName, qcDocUrl, qcExpected, qcLineResult } from "@/apps/rmstore/lib/finder/coilFinderData";
import { printCoilReport } from "@/apps/rmstore/lib/utils/coilReportActions";

function Panel({ icon: Icon, iconClass, title, sub, count, actions, children }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className={`${iconClass} shrink-0`} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">{title}</p>
            {sub ? <p className="text-[10px] text-slate-500 truncate">{sub}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {actions || null}
          {count != null ? (
            <span className="text-[10px] font-bold text-slate-500 uppercase">{count}</span>
          ) : null}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function DetailGrid({ rows }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-[9px] font-bold text-slate-400 uppercase">{label}</dt>
          <dd className="text-[11px] font-semibold text-slate-800 break-all mt-0.5">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function JourneyTimeline({ events }) {
  if (!events.length) {
    return <p className="text-[11px] text-slate-400 italic">No journey events found.</p>;
  }

  return (
    <ol className="space-y-0 max-h-[400px] overflow-y-auto divide-y divide-slate-100">
      {events.map((ev, index) => {
        const lines = (ev.lines || []).filter((l) => l.value && l.value !== "—");
        return (
          <li key={ev.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-col items-center shrink-0 w-6">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {index + 1}
              </span>
              {index < events.length - 1 ? <span className="w-px flex-1 bg-slate-200 mt-1" aria-hidden /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <span className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase leading-none ${ev.badgeClass}`}>
                  {ev.title}
                </span>
                <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                  {ev.at ? formatDateTime(ev.at) : "—"}
                </span>
              </div>
              {lines.length ? (
                <dl className="space-y-0.5">
                  {lines.map(({ label, value }) => (
                    <div key={label} className="flex gap-1.5 text-[10px] leading-snug">
                      <dt className="text-slate-400 shrink-0">{label}</dt>
                      <dd className="text-slate-800 font-semibold break-all min-w-0">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DocRow({ doc }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
      <FileText size={13} className="text-emerald-600 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-800 truncate">{doc.label}</p>
        <p className="text-[9px] text-slate-500 truncate">{doc.sub}</p>
        <p className="text-[9px] text-slate-400 truncate mt-0.5">{doc.fileName}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <FilePreviewLink
          href={doc.url}
          fileName={doc.fileName}
          className="px-2 py-1 text-[9px] font-bold uppercase text-indigo-700 border border-indigo-100 rounded hover:bg-indigo-50"
          title={`Preview ${doc.fileName}`}
        >
          View
        </FilePreviewLink>
        <button
          type="button"
          onClick={() => void downloadFileInPlace(doc.url, doc.fileName)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase text-slate-700 border border-slate-200 rounded hover:bg-slate-50"
          title={`Download ${doc.fileName}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function DocumentsPanel({ documents, loading }) {
  if (!documents.length && !loading) return null;

  return (
    <Panel
      icon={FileText}
      iconClass="text-violet-600"
      title="Documents"
      sub="QC uploads · in-process rejection photos · TC / RMTC"
      count={loading ? null : `${documents.length} file${documents.length === 1 ? "" : "s"}`}
    >
      {loading && !documents.length ? (
        <Loader2 className="animate-spin text-violet-500 mx-auto" size={22} />
      ) : documents.length ? (
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 px-2 max-h-[280px] overflow-y-auto">
          {documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">No uploaded documents found for this coil.</p>
      )}
    </Panel>
  );
}

function QcResult({ result }) {
  if (!result) return <span className="text-[9px] text-slate-300">—</span>;
  const pass = result === "pass";
  return (
    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${pass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

function QcBlock({ checks }) {
  if (!checks.length) {
    return <p className="text-[11px] text-slate-400 italic">QC details could not be loaded.</p>;
  }
  return (
    <div className="space-y-3 max-h-[520px] overflow-y-auto">
      {checks.map((check) => (
        <div key={check.qc_check_uid} className="rounded-lg border border-sky-200 bg-sky-50/40 overflow-hidden">
          <p className="px-3 py-1.5 text-xs font-bold text-sky-900 bg-sky-50 border-b border-sky-100">
            QC Check #{check.qc_check_uid}
          </p>
          <div className="p-3 space-y-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {buildQcSummary(check).map(({ label, value, tone }) => (
                <div key={label}>
                  <dt className="text-[9px] font-bold text-slate-400 uppercase">{label}</dt>
                  <dd
                    className={`text-[11px] font-semibold break-all mt-0.5 ${
                      tone === "pass" ? "text-emerald-700" : tone === "fail" ? "text-rose-700" : "text-slate-800"
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {!check.items?.length ? (
              <p className="text-[11px] text-slate-400 italic">No spec lines.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-slate-50 border-b uppercase text-[9px] text-slate-500">
                    <tr>
                      <th className="px-2 py-1">#</th>
                      <th className="px-2 py-1">Spec</th>
                      <th className="px-2 py-1">Inspection Method</th>
                      <th className="px-2 py-1">Expected</th>
                      <th className="px-2 py-1">Actual</th>
                      <th className="px-2 py-1">Result</th>
                      <th className="px-2 py-1">Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.items.map((spec) => {
                      const doc = qcDocUrl(spec.document_note);
                      return (
                        <tr key={`${spec.spec_id}-${spec.sno}`} className="border-b border-slate-100">
                          <td className="px-2 py-1 font-bold text-slate-400">{spec.sno}</td>
                          <td className="px-2 py-1 font-bold text-slate-800">{spec.spec_name || "—"}</td>
                          <td className="px-2 py-1 text-slate-600">
                            {spec.inspection_method ? String(spec.inspection_method) : "—"}
                          </td>
                          <td className="px-2 py-1 font-mono">{qcExpected(spec)}</td>
                          <td className="px-2 py-1 font-mono">{spec.actual_value ?? "—"}</td>
                          <td className="px-2 py-1">
                            <QcResult result={qcLineResult(spec)} />
                          </td>
                          <td className="px-2 py-1">
                            {doc ? (
                              <FilePreviewLink href={doc} fileName={qcDocName(spec.document_note) || "Document"} className="text-indigo-700 font-bold hover:underline inline-flex items-center gap-1">
                                <FileText size={11} />
                                {qcDocName(spec.document_note) || "View"}
                              </FilePreviewLink>
                            ) : spec.document_required ? (
                              <span className="text-rose-500 font-bold">Missing</span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** RM Store Coil Finder — details, QC, journey (not Location Finder). */
export default function CoilFinderDetailsSection({ coil }) {
  const [loading, setLoading] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [details, setDetails] = useState([]);
  const [events, setEvents] = useState([]);
  const [qcChecks, setQcChecks] = useState([]);
  const [documents, setDocuments] = useState([]);

  const scanKey = coil ? `${coilJourneyKey(coil)}|${coil?.qc_uid ?? ""}` : "";

  useEffect(() => {
    if (!coil || !coilJourneyKey(coil)) {
      setDetails([]);
      setEvents([]);
      setQcChecks([]);
      setDocuments([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchCoilFinderData(coil)
      .then((data) => {
        if (cancelled) return;
        setDetails(data.details);
        setEvents(data.events);
        setQcChecks(data.qcChecks);
        setDocuments(data.documents || []);
      })
      .catch(() => {
        if (!cancelled) {
          setDetails([]);
          setEvents([]);
          setQcChecks([]);
          setDocuments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scanKey]);

  /** Same-page print preview via shared coilReportActions. */
  const handlePrintReport = async () => {
    if (!coil || printBusy) return;
    await printCoilReport({
      coil_no_uid: coil.coil_no_uid,
      printing: printBusy,
      setPrinting: setPrintBusy,
    });
  };

  if (!coil) return null;

  const showQc = coilHasQcLink(coil) || qcChecks.length > 0;
  const printDisabled = loading || printBusy;

  return (
    <div className="space-y-4 pt-4 mt-2 border-t-2 border-slate-200">
      <Panel
        icon={History}
        iconClass="text-indigo-600"
        title="Full record details"
        sub="Print QC report"
        actions={
          <>
            <button
              type="button"
              disabled={printDisabled}
              onClick={() => void handlePrintReport()}
              className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50"
              title="Print QC report"
            >
              {printBusy ? <Loader2 size={11} className="animate-spin" /> : <Printer size={11} />}
              Print QC
            </button>
          </>
        }
      >
        {loading && !details.length ? (
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={22} />
        ) : (
          <DetailGrid rows={details} />
        )}
      </Panel>

      <DocumentsPanel documents={documents} loading={loading} />

      {showQc ? (
        <Panel
          icon={ClipboardCheck}
          iconClass="text-sky-600"
          title="QC Check"
          sub="Specifications · pass / fail · documents"
          count={loading ? null : `${qcChecks.length} record${qcChecks.length === 1 ? "" : "s"}`}
        >
          {loading && !qcChecks.length ? (
            <Loader2 className="animate-spin text-sky-500 mx-auto" size={22} />
          ) : (
            <QcBlock checks={qcChecks} />
          )}
        </Panel>
      ) : null}

      <Panel
        icon={History}
        iconClass="text-emerald-600"
        title="Journey"
        sub="Top to bottom · oldest first"
        count={loading ? null : `${events.length} events`}
      >
        {loading && !events.length ? (
          <div className="py-6 text-center">
            <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={24} />
            <p className="text-[11px] text-slate-500">Loading journey…</p>
          </div>
        ) : (
          <JourneyTimeline events={events} />
        )}
      </Panel>
    </div>
  );
}
