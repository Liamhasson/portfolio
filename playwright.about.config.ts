import { defineConfig, devices } from "@playwright/test";

// About's specs (the pictures, the pendant) on their own port: 3100 and 3101 are other chats' servers. Turbopack's build is broken site-wide by Google Fonts' Inter (tracked separately), so build with webpack.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["about-pictures.spec.ts", "about-pendant.spec.ts", "about-testimonials.spec.ts"],
  timeout: 60_000,
  use: { baseURL: "http://localhost:3102" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } } }],
  webServer: {
    command: "npx next build --webpack && npx next start -p 3102",
    url: "http://localhost:3102/about",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
