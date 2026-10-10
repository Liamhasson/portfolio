import { defineConfig, devices } from "@playwright/test";

// The mockup boards are static HTML; they don't need the Next.js build.
export default defineConfig({
  testDir: "./e2e-board",
  use: { baseURL: "http://localhost:4323" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 960 } } },
  ],
  webServer: {
    command: "python3 -m http.server 4323 --bind 127.0.0.1 --directory docs/prototypes",
    url: "http://localhost:4323/cyvore-mockups.html",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
