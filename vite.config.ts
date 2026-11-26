import { loadEnv, type Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolvePublicUrl } from "./src/lib/publicUrl";

// Dev only: the web app and the backend share one origin through this proxy,
// so a single HTTPS tunnel link works on a phone.
const DEV_BACKEND = process.env.DEV_BACKEND_PROXY ?? "http://127.0.0.1:5001";

function openGraphTagsPlugin(publicUrl: string): Plugin {
  return {
    name: "tap2stacks-og-meta",
    transformIndexHtml(html) {
      return html.replaceAll("__PUBLIC_URL__", publicUrl);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicUrl = resolvePublicUrl(
    env.VITE_PUBLIC_URL ?? process.env.VITE_PUBLIC_URL,
  );

  return {
    plugins: [react(), tailwindcss(), openGraphTagsPlugin(publicUrl)],
    server: {
      allowedHosts: [".trycloudflare.com"],
      proxy: {
        "/api": { target: DEV_BACKEND, changeOrigin: true },
        "/socket.io": { target: DEV_BACKEND, changeOrigin: true, ws: true },
      },
    },
    test: {
      environment: "jsdom",
      // Builder worktrees live inside this folder; their tests belong to their own runs.
      exclude: [...configDefaults.exclude, ".*-worktrees/**"],
    },
  };
});
