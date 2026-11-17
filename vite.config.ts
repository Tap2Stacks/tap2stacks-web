import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev only: the web app and the backend share one origin through this proxy,
// so a single HTTPS tunnel link works on a phone.
const DEV_BACKEND = process.env.DEV_BACKEND_PROXY ?? "http://127.0.0.1:5001";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: DEV_BACKEND, changeOrigin: true },
      "/socket.io": { target: DEV_BACKEND, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: "jsdom",
  },
});
