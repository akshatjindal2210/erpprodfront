import packageJson from "../../package.json" with { type: "json" };

/** Shown in UI (Quick Access bar). Keep in sync with release tags. */
export const APP_VERSION = packageJson.version;
