import createWebStorage from "redux-persist/lib/storage/createWebStorage";

function createNoopStorage() {
  return {
    getItem() {
      return Promise.resolve(null);
    },
    setItem(_key, value) {
      return Promise.resolve(value);
    },
    removeItem() {
      return Promise.resolve();
    },
  };
}

/** SSR-safe storage — avoids redux-persist sync storage console error on the server. */
const persistStorage =
  typeof window !== "undefined" ? createWebStorage("local") : createNoopStorage();

export default persistStorage;
