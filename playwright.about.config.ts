import { defineConfig, devices } from "@playwright/test";

// About's pendant on its own port (3100 and 3101 are the other sessions' servers). WebGL needs a GPU-backed Chromium.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "about-pendant.spec.ts",
  use: { baseURL: "http://localhost:3102" },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1440, height: 900 },
      launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] },
    },
  }],
  webServer: {
    // (webpack, not Turbopack: since 2026-10-16 Google serves Inter as /l/font?kit=…&skey=… URLs, which Turbopack's
    // next/font can't parse, "queries have exactly one entry"; back to plain `npm run build` once that is fixed)
    command: "npm run build -- --webpack && npx next start -p 3102",
    url: "http://localhost:3102/about",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
