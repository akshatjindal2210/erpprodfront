"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Clock, Inbox } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { manageTrayService } from "@/apps/ims/lib/services/manageTray";
import ManageTrayReceiveModal from "@/apps/ims/modules/manage-tray/ManageTrayReceiveModal";
import ManageTrayReassignModal from "@/apps/ims/modules/manage-tray/ManageTrayReassignModal";

const ACCENT = {
  emerald: {
    card: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50",
    title: "text-emerald-800",
    submit: "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50/60 hover:border-indigo-400 hover:bg-indigo-50",
    title: "text-indigo-900",
    submit: "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700",
  },
  yellow: {
    card: "border-yellow-300 bg-yellow-50/60 hover:border-yellow-400 hover:bg-yellow-50",
    title: "text-yellow-900",
    submit: "bg-yellow-600 shadow-yellow-100 hover:bg-yellow-700",
  },
};

const OPTIONS = [
  { id: "receive", title: "Receive", description: "Scan a tray that was sent to a customer.", icon: Inbox, accent: "emerald", hint: "Customer tray only" },
  { id: "reassign", title: "Reassign", description: "Move a sticker onto another tray.", icon: ArrowRightLeft, accent: "indigo", hint: "Scan sticker, then new tray" },
  { id: "pending", title: "Pending", description: "Search a packing and start linking.", icon: Clock, accent: "yellow", hint: "Search packing, then start" },
];

const TITLES = { receive: "Receive", reassign: "Reassign", pending: "Pending" };

export default function ManageTrayStartModal({ open, onClose, onStartPending, onDone }) {
  const [action, setAction] = useState(null);
  const [picked, setPicked] = useState(null);
  const [bind, setBind] = useState(null);
  const option = OPTIONS.find((o) => o.id === action) || null;
  const accent = ACCENT[option?.accent] || ACCENT.indigo;

  useEffect(() => {
    if (!open) {
      setAction(null);
      setPicked(null);
      setBind(null);
    }
  }, [open]);

  const close = () => onClose?.();

  const finish = () => {
    onDone?.();
    close();
  };

  const description = !action ? (
    "Select type"
  ) : (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 normal-case tracking-normal font-semibold">
      <span className="uppercase tracking-tight font-bold">{option.hint}</span>
      <span className="text-slate-300 font-normal" aria-hidden>·</span>
      <button
        type="button"
        onClick={() => {
          setAction(null);
          setPicked(null);
          setBind(null);
        }}
        className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-bold"
      >
        Change type
      </button>
    </span>
  );

  const footer = action ? (
    <div className="flex justify-end gap-3 w-full">
      <button type="button" onClick={close} className="px-5 py-2 text-sm font-bold text-slate-500">
        Cancel
      </button>
      {action === "pending" ? (
        <button
          type="button"
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            const row = picked;
            setAction(null);
            setPicked(null);
            close();
            onStartPending?.(row);
          }}
          className={`min-w-[140px] px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg disabled:bg-slate-300 transition-all active:scale-95 ${accent.submit}`}
        >
          Start
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => bind?.clear?.()}
            disabled={bind?.saving || !bind?.clear}
            className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => bind?.submit?.()}
            disabled={!bind?.canSubmit}
            className={`min-w-[140px] px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg disabled:bg-slate-300 transition-all active:scale-95 ${accent.submit}`}
          >
            {bind?.saving ? "Processing..." : "Submit"}
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <Drawer
      isOpen={open}
      onClose={close}
      onSubmit={() => {
        if (action === "pending" && picked) {
          const row = picked;
          setAction(null);
          setPicked(null);
          close();
          onStartPending?.(row);
          return;
        }
        if (bind?.canSubmit) bind.submit();
      }}
      title={action ? TITLES[action] : "New"}
      description={description}
      footer={footer}
      maxWidth="max-w-3xl"
      closeOnOutside={action !== "receive" && action !== "reassign"}
    >
      {!action ? (
        <div className="space-y-3 py-2">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Select type</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {OPTIONS.map((item) => {
              const tone = ACCENT[item.accent];
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setBind(null);
                    setPicked(null);
                    setAction(item.id);
                  }}
                  className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${tone.card}`}
                >
                  <div className={`flex items-center gap-2 ${tone.title}`}>
                    <Icon size={17} />
                    <span className="text-sm font-black uppercase tracking-wide">{item.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">{item.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          {action === "receive" && (
            <ManageTrayReceiveModal embedded open onClose={finish} onSuccess={onDone} onBind={setBind} />
          )}
          {action === "reassign" && (
            <ManageTrayReassignModal embedded open onClose={finish} onSuccess={onDone} onBind={setBind} />
          )}
          {action === "pending" && (
            <div className="space-y-3">
              <SearchableSelect
                label="Pending packing"
                placeholder="Search packing, item, or customer"
                value={picked?.id ?? ""}
                resolvedOption={picked}
                onChange={(_id, item) => setPicked(item || null)}
                fetchService={(params) =>
                  manageTrayService.getAll({
                    ...params,
                    sortBy: "created_at",
                    order: "DESC",
                    filters: { approved: false },
                  })
                }
                dataKey="id"
                labelKey="packing_number"
                subLabelKey="item_code"
                listHintLabel="Item"
                preserveApiOrder
                required
              />
              <div className="p-3 bg-amber-50 rounded-lg border border-dashed border-amber-200">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  Search a pending packing, then Start. Scan stickers and trays in the next form.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
