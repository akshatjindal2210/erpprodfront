"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/core/store/index";
import FormPanelLoader from "@/core/components/common/FormPanelLoader";
import AuthBootstrap from "@/core/components/providers/AuthBootstrap";

export default function ReduxProvider({ children }) {
  const [showBootLoader, setShowBootLoader] = useState(true);

  useEffect(() => {
    // If rehydrate is slow, hide the boot loader but keep PersistGate mounted
    // so the React tree is not replaced (replacing it remounts forms and clears inputs).
    const timer = setTimeout(() => setShowBootLoader(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const bootLoader = showBootLoader ? (
    <FormPanelLoader
      label="Loading..."
      hint="Please wait."
      minHeight="min-h-screen"
      className="border-0 rounded-none bg-[#f8fafc] w-full"
    />
  ) : null;

  return (
    <Provider store={store}>
      <PersistGate loading={bootLoader} persistor={persistor}>
        <AuthBootstrap>{children}</AuthBootstrap>
      </PersistGate>
    </Provider>
  );
}
