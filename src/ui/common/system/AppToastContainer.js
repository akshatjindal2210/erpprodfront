"use client";

import { ToastContainer } from "react-toastify";

export default function AppToastContainer() {
  return (
    <ToastContainer
      position="bottom-left"
      autoClose={2800}
      hideProgressBar
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss={false}
      draggable={false}
      limit={3}
      theme="colored"
      className="imp-toast-container"
      toastClassName="imp-toast"
      bodyClassName="imp-toast-body"
    />
  );
}
