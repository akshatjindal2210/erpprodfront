"use client";

import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/core/store/index";
import FormPanelLoader from "@/core/components/common/FormPanelLoader";
import AuthBootstrap from "@/core/components/providers/AuthBootstrap";

export default function ReduxProvider({ children }) {
  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <FormPanelLoader
            label="Loading..."
            hint="Please wait."
            minHeight="min-h-screen"
            className="border-0 rounded-none bg-[#f8fafc] w-full"
          />
        }
        persistor={persistor}
      >
        <AuthBootstrap>{children}</AuthBootstrap>
      </PersistGate>
    </Provider>
  );
}
