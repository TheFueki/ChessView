import path from "node:path";
import { defineConfig, loadEnv, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverUrl = env.VITE_SERVER_URL || "http://localhost:8000";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || serverUrl;
  const wsProxyTarget = env.VITE_WS_PROXY_TARGET || serverUrl.replace(/^http/, "ws");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        "/media": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        "/ws": {
          target: wsProxyTarget,
          ws: true,
        },
      },
    },
  };
});
