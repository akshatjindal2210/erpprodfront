"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/platform/store/index";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import AuthBootstrap from "@/platform/components/providers/AuthBootstrap";
import CompanyNetworkGate from "@/ui/common/system/CompanyNetworkGate";

export default function ReduxProvider({ children }) {
  const [showBootLoader, setShowBootLoader] = useState(true);

  useEffect(() => {
    // If rehydrate is slow, hide the boot loader but keep PersistGate mounted
    // so the React tree is not replaced (replacing it remounts forms and clears inputs).
    const timer = setTimeout(() => setShowBootLoader(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const bootLoader = showBootLoader ? <FormPanelLoader fullScreen /> : null;

  return (
    <Provider store={store}>
      <PersistGate loading={bootLoader} persistor={persistor}>
        <CompanyNetworkGate>
          <AuthBootstrap>{children}</AuthBootstrap>
        </CompanyNetworkGate>
      </PersistGate>
    </Provider>
  );
}
