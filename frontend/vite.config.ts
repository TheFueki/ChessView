import path from "node:path";
import { defineConfig, loadEnv, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const requireEnv = (env: Record<string, string>, key: string): string => {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} must be set`);
  }

  return value;
};

export default defineConfig(({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = requireEnv(env, "VITE_API_PROXY_TARGET");
  const wsProxyTarget = requireEnv(env, "VITE_WS_PROXY_TARGET");

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
