"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, MapPin, User, UserRoundCog } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { auditService } from "@/apps/ims/lib/services/audit";
import { userService } from "@/common/auth/services/userService";
import {
  FORM_ERROR_CLASS,
  FORM_LABEL_CLASS,
  FORM_MICRO_LABEL_CLASS,
} from "@/ui/common/Constants";
import { getLocationStatusLabel } from "./auditScanHelpers";

export default function AuditReassignModal({ open, onClose, onSuccess, locationRow }) {
  const [loading, setLoading] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAssignedUserId("");
    setError("");
  }, [open, locationRow?.row_id]);

  const handleSubmit = async () => {
    if (!locationRow) return;
    if (!assignedUserId) {
      setError("Select a new user");
      return;
    }
    if (Number(assignedUserId) === Number(locationRow.assigned_user_id)) {
      setError("This user is already assigned to this location");
      return;
    }

    setLoading(true);
    try {
      const res = await auditService.reassignLocation({
        audit_id: locationRow.audit_id,
        location_id: locationRow.location_id,
        assigned_user_id: assignedUserId,
      });
      if (res?.success) {
        toast.success(res.message || "Location reassigned");
        onSuccess?.();
        onClose();
      } else {
        toast.error(res?.message || "Reassign failed");
      }
    } catch (err) {
      toast.error(err?.message || "Reassign failed");
    } finally {
      setLoading(false);
    }
  };

  if (!locationRow) return null;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Reassign Location"
      description={`Audit #${locationRow.audit_id} — new user starts a fresh audit for this location`}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserRoundCog size={16} />}
            Reassign
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <MapPin size={14} className="text-indigo-500 shrink-0" />
            <span className="text-sm font-black uppercase">{locationRow.location_no}</span>
          </div>
          <p className={FORM_MICRO_LABEL_CLASS}>
            Status: {getLocationStatusLabel(locationRow.location_status)}
          </p>
          <p className="text-xs text-slate-600">
            Current: <span className="font-bold">{locationRow.assigned_user_name || "—"}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label className={FORM_LABEL_CLASS}>New Assigned User</label>
          <SearchableSelect
            value={assignedUserId}
            onChange={(id) => {
              setAssignedUserId(id ?? "");
              if (error) setError("");
            }}
            fetchService={(params) =>
              userService.getViews({
                ...params,
                permission_module: "audit",
                permission_action: "view",
              })
            }
            getByIdService={(id) => userService.getById(id)}
            dataKey="id"
            labelKey="name"
            subLabelKey="usercode"
            icon={User}
            placeholder="Select new user…"
          />
          {error && (
            <p className={FORM_ERROR_CLASS}>
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          Previous work is saved in the database only (not shown on screen).
          The new user will see a <span className="font-bold">fresh</span> location and scan from scratch.
        </p>
      </div>
    </Drawer>
  );
}
