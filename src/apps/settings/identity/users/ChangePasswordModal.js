"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { errInput, okInput, formFieldLabelCls, FieldError } from "@/ui/common/Constants";
import { userService } from "@/common/auth/services/userService";

export default function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const set = (k) => (e) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.oldPassword.trim()) e.oldPassword = "Old password is required";
    if (!form.newPassword.trim()) e.newPassword = "New password is required";
    else if (form.newPassword.length < 6) e.newPassword = "Password must be at least 6 characters";
    
    if (!form.confirmPassword.trim()) e.confirmPassword = "Confirm password is required";
    else if (form.confirmPassword !== form.newPassword) e.confirmPassword = "Passwords do not match";
    
    return e;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await userService.changePassword({
        currentPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
      toast.success("Password changed successfully");
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      onClose();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      title="Change Password"
      description="Update your account password to keep it secure"
      headerVariant="form"
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Updating…
              </>
            ) : (
              <><Check size={15} />Update Password</>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <label className={formFieldLabelCls}>
            Old Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showOldPass ? "text" : "password"}
              value={form.oldPassword}
              onChange={set("oldPassword")}
              placeholder="Enter current password"
              className={errors.oldPassword ? errInput : okInput}
            />
            <button
              type="button"
              onClick={() => setShowOldPass(!showOldPass)}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400"
            >
              {showOldPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <FieldError msg={errors.oldPassword} />
        </div>

        <div className="space-y-1">
          <label className={formFieldLabelCls}>
            New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showNewPass ? "text" : "password"}
              value={form.newPassword}
              onChange={set("newPassword")}
              placeholder="Enter new password"
              className={errors.newPassword ? errInput : okInput}
            />
            <button
              type="button"
              onClick={() => setShowNewPass(!showNewPass)}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400"
            >
              {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <FieldError msg={errors.newPassword} />
        </div>

        <div className="space-y-1">
          <label className={formFieldLabelCls}>
            Confirm New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirmPass ? "text" : "password"}
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="Confirm new password"
              className={errors.confirmPassword ? errInput : okInput}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPass(!showConfirmPass)}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400"
            >
              {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <FieldError msg={errors.confirmPassword} />
        </div>
      </div>
    </Drawer>
  );
}

