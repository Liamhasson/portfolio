import { expect, test } from "@playwright/test";

/** Part C final review: findings fixed, each pinned by a test that failed first. */

test("Pulse's coded screens keep the app's own type (30px/700 titles, 15px body)", async ({ page }) => {
  await page.goto("/pulse", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __pulseStories?: Record<string, unknown> }).__pulseStories?.desktop);
  const t = await page.evaluate(() => {
    const scr = document.querySelectorAll('.ob[data-story="desktop"] .ob-screen')[1];
    const css = (sel: string) => { const s = getComputedStyle(scr.querySelector(sel)!); return `${s.fontSize}/${s.fontWeight}`; };
    return { display: css(".pa-display"), body: css(".pa-body") };
  });
  expect(t).toEqual({ display: "30px/700", body: "15px/400" });
});

for (const [slug, fonts] of [["eventread", 2], ["cyvore", 5], ["pulse", 4]] as const) {
  test(`/${slug} preloads only its own fonts (${fonts})`, async ({ page }) => {
    await page.goto(`/${slug}`);
    expect(await page.locator('link[rel="preload"][as="font"]').count()).toBe(fonts);
  });
}

test("while fonts are still loading, Pulse's first screen already fits its phone", async ({ page }) => {
  await page.route("**/*.woff2", async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue(); });
  await page.goto("/pulse", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200); // hydrated, fonts still held back, the story engine not mounted yet
  const fit = await page.evaluate(() => {
    const screen = document.querySelector('.ob[data-story="desktop"] .phone-screen')!.getBoundingClientRect();
    const app = document.querySelector('.ob[data-story="desktop"] .ob-screen .pa')!.getBoundingClientRect();
    return Math.abs(app.width - screen.width);
  });
  expect(fit).toBeLessThan(2);
});

test.describe("the prototype dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pulse", { waitUntil: "load" });
    await page.waitForFunction(() => (window as unknown as { __pulseProto?: unknown }).__pulseProto);
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    await expect(page.getByRole("dialog", { name: "Pulse onboarding prototype" })).toBeVisible();
  });

  test("a click on its side text doesn't lose Escape or the focus trap", async ({ page }) => {
    await page.locator(".proto-note").click();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[data-proto]"))).toBe(true);
    }
    await page.locator(".proto-note").click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Pulse onboarding prototype" })).toBeHidden();
  });
});

test("the focus trap works where checkVisibility doesn't exist (Safari < 17.4)", async ({ page }) => {
  await page.addInitScript(() => { delete (Element.prototype as unknown as { checkVisibility?: unknown }).checkVisibility; });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/pulse", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __pulseProto?: unknown }).__pulseProto);
  await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-proto]"))).toBe(true);
  }
  expect(errors).toEqual([]);
});

/* Liam, 2026-10-11: "two videos have changed into still images". The board's recordings play when on screen. */
for (const [slug, sel] of [["eventread", ".w-step"], ["cyvore", ".f.how"], ["pulse", ".f.how"]] as const) {
  test(`/${slug}: videos play once on screen, even after a jump straight to them`, async ({ page }) => {
    await page.goto(`/${slug}`, { waitUntil: "networkidle" });
    await page.evaluate((s) => document.querySelector(s)!.scrollIntoView(), sel);
    await expect.poll(() => page.evaluate((s) => [...document.querySelector(s)!.querySelectorAll("video")].every((v) => !v.paused && v.currentTime > 0), sel), { timeout: 8000 }).toBe(true);
  });
}

test("the heroes' videos play at load", async ({ page }) => {
  for (const slug of ["cyvore", "pulse"]) {
    await page.goto(`/${slug}`, { waitUntil: "networkidle" });
    await expect.poll(() => page.evaluate(() => { const v = document.querySelector("header video") as HTMLVideoElement; return !v.paused && v.currentTime > 0; }), { timeout: 8000 }).toBe(true);
  }
});
