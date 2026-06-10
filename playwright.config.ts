import { defineConfig, devices } from "@playwright/test";

const frontendUrl = process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:5173";
const adminUrl = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";
const reuseExistingServer = process.env.E2E_REUSE_EXISTING_SERVER === "1" || !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: "yarn dev --host 127.0.0.1 --port 5173",
      cwd: "./frontend",
      url: frontendUrl,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: "yarn dev --host 127.0.0.1 --port 5174",
      cwd: "./admin-frontend",
      url: adminUrl,
      reuseExistingServer,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
