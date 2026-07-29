"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { Lock } from "lucide-react";
import { selectRole } from "@/platform/store/slices/authSlice";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { SETTINGS_NAV_REGISTRY } from "@/apps/settings/configuration/config/settingsNavRegistry";
import { ROUTES } from "@/config/routes";

export default function SettingsPage() {
  const router = useRouter();
  const role = useSelector(selectRole);
  const canAccess = useCanAccess();
  const [checking, setChecking] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (!role) return;

    const firstAllowed = SETTINGS_NAV_REGISTRY.find(item => {
      if (item.roles?.length) {
        return item.roles.includes(role?.toLowerCase());
      }
      if (item.module) {
        return canAccess(item.module, "view").allowed;
      }
      return true; // if no module or roles specified, it's public within settings
    });

    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      setNoAccess(true);
      setChecking(false);
    }
  }, [role, canAccess, router]);

  if (checking) {
    return (
      <div className={`flex h-[calc(100vh-48px)] w-full items-center justify-center`}>
        <div className={`w-8 h-8 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin`} />
      </div>
    );
  }

  if (noAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-rose-200 animate-pulse">
          <Lock size={40} className="text-rose-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Access Restricted</h1>
        <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-8">
          You do not have the required permissions to view any settings modules. Please contact authorized personnel for access.
        </p>
      </div>
    );
  }

  return null;
}

