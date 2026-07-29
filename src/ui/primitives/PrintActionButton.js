"use client";

import ActionButton from "@/ui/primitives/ActionButton";

/**
 * Toolbar print action — visible and usable only when the user has module **view** permission.
 */
export default function PrintActionButton({ module, ...props }) {
  return <ActionButton module={module} action="view" {...props} />;
}
