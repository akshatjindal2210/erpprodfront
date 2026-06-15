const isLive = process.env.NEXT_PUBLIC_API_MODE === "live";
const hostname = typeof window !== "undefined" ? window.location.hostname : "";

export const BACKEND_URL = isLive
  ? hostname.includes(process.env.NEXT_PUBLIC_BACKEND_URL_DOMAIN) ? process.env.NEXT_PUBLIC_BACKEND_URL_INSIDE :  hostname.includes(process.env.NEXT_PUBLIC_BACKEND_URL2_DOMAIN) ? process.env.NEXT_PUBLIC_BACKEND_URL_OUTSIDE : process.env.NEXT_PUBLIC_BACKEND_URL_DEV
  : process.env.NEXT_PUBLIC_BACKEND_URL_DEV;

export const API_BASE_URL = `${BACKEND_URL}/api`;
export const FILE_BASE_URL = BACKEND_URL;
export const COOKIE_NAME = "auth_token";
