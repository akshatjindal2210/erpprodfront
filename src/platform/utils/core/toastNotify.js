import { toast } from "react-toastify";

/** Same refresh toast replaces the previous one instead of stacking. */
export function toastDataRefreshed() {
  toast.success("Data refreshed", { toastId: "data-refreshed" });
}
