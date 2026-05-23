"use client";

import { useState, useEffect, useImperativeHandle, forwardRef, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { moduleSopService } from "@/services/training";
import { focusAndScroll } from "@/utils/formFocus";

export function htmlToPlainFromHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Shows module SOP (read-only) and, when `is_required`, blocks submit until the user ticks the box.
 * Nothing is sent to the API — call `ref.current?.assertAcknowledged()` at the start of save/delete.
 *
 * {string} moduleSlug — `modules.name` (e.g. packing_standard, users)
 * {'view'|'add'|'edit'|'delete'|'authorize'} permissionType
 * {boolean} isOpen — drawer / modal open
 * {boolean} readOnly — no checkbox / always pass assert
 * {boolean} skip — render nothing & assert passes (e.g. meta SOP editor)
 * {boolean} fetchEnabled — when false, use `sopOverride` instead of calling helper
 * {object|null|undefined} sopOverride — when fetchEnabled false: null = no sop, object = sop row
 * {boolean} requireAckWhenPresent — any loaded SOP must be acknowledged (sticker add/delete only)
 * {(ready: boolean) => void} onGateReadyChange — whether user may proceed (no SOP / acknowledged / loading done)
 */

const ModuleSopAcknowledgment = forwardRef(function ModuleSopAcknowledgment({ moduleSlug, permissionType, isOpen, readOnly = false, skip = false, fetchEnabled = true, sopOverride = undefined, requireAckWhenPresent = false, onGateReadyChange, className = "" }, ref ) {
  const [sop, setSop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ack, setAck] = useState(false);
  const [ackError, setAckError] = useState(false);
  const containerRef = useRef(null);
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (skip || !isOpen) {
      setSop(null);
      setLoading(false);
      setAck(false);
      return;
    }

    if (!fetchEnabled) {
      setLoading(false);
      setSop(sopOverride === undefined ? null : sopOverride);
      return;
    }

    if (!moduleSlug || !permissionType) {
      setSop(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    moduleSopService
      .helper({ permission_module: moduleSlug, permission_action: permissionType, module_slug: moduleSlug, permission_type: permissionType })
      .then((res) => {
        if (cancelled) return;
        setSop(res?.data ?? null);
        setAck(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSop(null);
          setAck(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [skip, isOpen, fetchEnabled, sopOverride, moduleSlug, permissionType]);

  const focusAcknowledgment = useCallback(() => {
    if (containerRef.current) focusAndScroll(containerRef.current);
    requestAnimationFrame(() => {
      if (checkboxRef.current) {
        try {
          checkboxRef.current.focus({ preventScroll: true });
        } catch {
          checkboxRef.current.focus();
        }
      }
    });
  }, []);

  const sopPresent = !!sop;
  const mustAcknowledge =
    !skip && !readOnly && sopPresent && (requireAckWhenPresent || sop.is_required === true);

  const gateReady =
    skip || readOnly || (fetchEnabled && loading ? false : !mustAcknowledge || ack);

  useEffect(() => {
    onGateReadyChange?.(gateReady);
  }, [onGateReadyChange, gateReady]);

  const assertAcknowledged = useCallback(() => {
    if (skip || readOnly) return true;
    if (fetchEnabled && loading) {
      toast.warning("Please wait a moment.");
      return false;
    }
    if (!mustAcknowledge) return true;
    if (!ack) {
      setAckError(true);
      focusAcknowledgment();
      toast.warning("Please confirm you have read the Standard Operating Procedure before submitting.");
      return false;
    }
    setAckError(false);
    return true;
  }, [skip, readOnly, fetchEnabled, loading, mustAcknowledge, ack, focusAcknowledgment]);

  useImperativeHandle(ref, () => ({ assertAcknowledged, focusAcknowledgment }), [assertAcknowledged, focusAcknowledgment]);

  if (skip || !isOpen) return null;

  const showBlock =
    sopPresent &&
    (requireAckWhenPresent || sop.is_required || htmlToPlainFromHtml(sop.description));

  if (!showBlock) return null;

  const required = mustAcknowledge;

  return (
    <div
      ref={containerRef}
      data-field="sop_acknowledgment"
      className={`rounded-xl border p-4 space-y-3 ${required ? "border-amber-300 bg-amber-50/60" : "border-violet-200 bg-violet-50/50"} ${ackError ? "ring-2 ring-red-400 border-red-400" : ""} ${className}`}
    >
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
        Standard Operating Procedure
      </p>
      {htmlToPlainFromHtml(sop.description) ? (
        <div
          className="prose prose-sm max-w-none text-slate-800 max-h-48 overflow-y-auto custom-scrollbar border border-white/60 rounded-lg bg-white/80 p-3"
          dangerouslySetInnerHTML={{ __html: sop.description || "" }}
        />
      ) : (
        <p className="text-xs text-slate-500 italic">
          No detailed text — acknowledgment may still be required.
        </p>
      )}
      {required && (
        <label className="flex items-start gap-3 cursor-pointer select-none pt-0.5">
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-invalid={ackError || undefined}
            className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={ack}
            onChange={(e) => {
              setAck(e.target.checked);
              if (e.target.checked) setAckError(false);
            }}
          />
          <span className="text-sm font-semibold text-slate-800 leading-snug">
            I have read and agree to this Standard Operating Procedure *
          </span>
        </label>
      )}
    </div>
  );
});

export default ModuleSopAcknowledgment;
