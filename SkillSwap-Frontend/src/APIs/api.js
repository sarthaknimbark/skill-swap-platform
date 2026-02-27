import axios from "axios";

const getBaseURL = () => {
  // Highest priority: explicit env override
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // If running in a browser, decide based on hostname
  if (typeof window !== "undefined") {
    const { protocol, hostname, host } = window.location;

    // Local development: keep talking to backend on :3000
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3000/api";
    }

    // Production: assume backend is mounted under /api on same origin
    return `${protocol}//${host}/api`;
  }

  // Fallback (SSR / unknown env)
  return "http://localhost:3000/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

export default API;