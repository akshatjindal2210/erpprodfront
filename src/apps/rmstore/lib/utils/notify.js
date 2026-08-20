import { toast } from "react-toastify";

/**
 * Simplest way to show notifications based on backend response.
 * Backend returns: { success: true, message: "...", toast_type: "success" | "warning" }
 */
export const notify = (res, fallback = "Action completed") => {
  const type = res?.toast_type || "success";
  const msg = res?.message || fallback;
  if (type === "warning") {
    toast.warning(msg);
  } else {
    toast.success(msg);
  }
};
