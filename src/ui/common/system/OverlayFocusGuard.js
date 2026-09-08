"use client";

import { useLayoutEffect } from "react";
import { installOverlayFocusGuard } from "@/platform/utils/system/overlayFocusGuard";

/** App-wide Tab focus trap for drawers and center modals. */
export default function OverlayFocusGuard() {
  useLayoutEffect(() => installOverlayFocusGuard(), []);
  return null;
}
