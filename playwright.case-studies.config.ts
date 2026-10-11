import { defineConfig, devices } from "@playwright/test";

// Case-study pages on their own port: 3100 is the other chat's server.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["case-studies.spec.ts", "cs-*.spec.ts"],
  use: { baseURL: "http://localhost:3101" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npm run build && npx next start -p 3101",
    url: "http://localhost:3101/eventread",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
