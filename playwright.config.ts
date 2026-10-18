import { defineConfig, devices } from "@playwright/test";

// E2E_PORT: another port (3100 is the default); E2E_REUSE=1: test a server already running there (its own build)
const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: process.env.E2E_REUSE === "1",
    timeout: 180_000,
  },
});
