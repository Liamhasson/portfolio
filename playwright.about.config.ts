import { defineConfig, devices } from "@playwright/test";

// About's specs (the pictures, the pendant) on their own port: 3100 and 3101 are other chats' servers. Turbopack's build is broken site-wide by Google Fonts' Inter (tracked separately), so build with webpack.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["about-pictures.spec.ts", "about-pendant.spec.ts", "about-testimonials.spec.ts"],
  timeout: 60_000,
  use: { baseURL: "http://localhost:3102" },
  projects: [
    // (tests tagged @webkit are Safari's: left out here)
    { name: "chromium", grepInvert: /@webkit/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } } },
    // Safari (WebKit): the testimonials' light and ball without the lens (plan 2026-10-17-about-testimonials-light, Task 6
    // Step 2). Only the spec's @webkit tests: the rest test Chromium-only things (the lens and its seams, the anchoring
    // stub, the GPU timers) or pixels tuned to Chromium.
    { name: "webkit", testMatch: ["about-testimonials.spec.ts"], grep: /@webkit/, use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npx next build --webpack && npx next start -p 3102",
    url: "http://localhost:3102/about",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
