"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { gatePassService } from "@/apps/hrms/lib/services/hrms";
import { GatePassReadonlyFields } from "@/apps/hrms/modules/gate-pass/GatePassDrawer";

export default function GatePassViewPage({ passId }) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [denied, setDenied] = useState(false);
  const numericId = /^\d+$/.test(String(passId ?? "").trim()) ? Number(passId) : null;

  useEffect(() => {
    const id = numericId;
    if (!id || id <= 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDenied(false);
      try {
        const res = await gatePassService.view(id);
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.message || "Failed to load gate pass.");
        setRecord(res.data);
      } catch (e) {
        if (cancelled) return;
        if (e?.status === 403) {
          setDenied(true);
          setRecord(null);
          return;
        }
        toast.error(e?.message || "Failed to load gate pass.");
        setRecord(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [numericId, passId]);

  if (loading) {
    return <p className="text-sm text-slate-500 p-6">Loading gate pass…</p>;
  }
  if (denied) {
    return <p className="text-sm text-red-600 p-6">You do not have access to view this gate pass.</p>;
  }
  if (!numericId) {
    return <p className="text-sm text-slate-500 p-6">Invalid gate pass link.</p>;
  }
  if (!record) {
    return <p className="text-sm text-slate-500 p-6">Gate pass not found.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-lg font-bold text-slate-800 mb-4">Gate Pass #{record.id}</h1>
      <p className="text-xs text-slate-500 mb-4">View only — OUT/IN is recorded at IMS Gate Entry scan.</p>
      <GatePassReadonlyFields r={record} showQr={false} />
    </div>
  );
}
