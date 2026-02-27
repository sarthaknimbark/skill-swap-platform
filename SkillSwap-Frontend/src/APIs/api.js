import axios from "axios";

// Decide API base URL from env, with localhost as dev fallback only
const getBaseURL = () => {
  // 1) Prefer explicit API base URL
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 2) Fallback to legacy VITE_BACKEND_URL if present
  if (import.meta.env.VITE_BACKEND_URL) {
    // Ensure it ends with /api for consistency
    if (import.meta.env.VITE_BACKEND_URL.endsWith("/api")) {
      return import.meta.env.VITE_BACKEND_URL;
    }
    return `${import.meta.env.VITE_BACKEND_URL.replace(/\/$/, "")}/api`;
  }

  // 3) Local dev default
  return "http://localhost:3000/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

export default API;