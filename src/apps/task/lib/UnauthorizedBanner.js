"use client";

import { useSearchParams } from "next/navigation";
import { ShieldX, X } from "lucide-react";
import { useState } from "react";

export default function UnauthorizedBanner() {
  const params = useSearchParams();
  const [show, setShow] = useState(params.get("unauthorized") === "true");

  if (!show) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4">
      <div className="flex items-center gap-2">
        <ShieldX size={16} className="flex-shrink-0" />
        <span className="font-medium">Access Denied</span>
        <span className="text-rose-500">— You don't have permission to access that page.</span>
      </div>
      <button onClick={() => setShow(false)} className="text-rose-400 hover:text-rose-600">
        <X size={14} />
      </button>
    </div>
  );
}