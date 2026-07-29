"use client";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";

import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import persistStorage from "./persistStorage";

import { encryptTransform } from "redux-persist-transform-encrypt";

const encryptor = encryptTransform({
  secretKey: process.env.NEXT_PUBLIC_SECRET_KEY_REDUX,
  onError: (err) => console.log("Encryption Error:", err),
});

const rootReducer = combineReducers({
  auth: authReducer,
});

const persistConfig = {
  key: "root",
  storage: persistStorage,
  transforms: [encryptor],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);