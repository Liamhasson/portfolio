import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectNoHorizontalScroll, expectTextFloors } from "./cs-helpers";

/** The Marni Came band site in release week (spec 2026-10-20 §5; plan Task 5). */
const URL = "/marni-came/site";

async function noAddedGlow(page: Page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll("article *")].flatMap((el) => {
    const s = getComputedStyle(el);
    const blurred = s.boxShadow !== "none" && s.boxShadow.split(/,(?![^(]*\))/).some((sh) => { const n = sh.match(/(-?\d*\.?\d+)px/g) ?? []; return n.length >= 3 && parseFloat(n[2]) > 0; });
    return s.textShadow !== "none" || blurred ? [`${el.tagName}.${el.className}`] : [];
  }));
  expect(bad).toEqual([]);
}

test("its own page: no portfolio nav or name, kept out of search", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("[data-nav-chrome]")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: /site/i })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("release week: the sections, one title line, sound off, no audio playing", async ({ page }) => {
  await page.goto(URL);
  for (const id of ["music", "videos", "shows", "merch", "band"]) await expect(page.locator(`#${id}`)).toBeVisible();
  const title = page.locator(".rel-title");
  await expect(title).toHaveText(/After Heartbreaks/i);
  const { h, lh } = await title.evaluate((el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight) }));
  expect(h).toBeLessThan(lh * 1.3);
  await expect(page.getByRole("button", { name: /sound off/i })).toHaveAttribute("aria-pressed", "false");
  const playing = await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused));
  expect(playing).toBe(false);
});

test("Watch the video opens the full video in a dialog", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("button", { name: /watch the video/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("video")).toHaveAttribute("src", /after-heartbreaks\.mp4/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Listen plays After Heartbreaks and the toggle follows", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("button", { name: /^listen$/i }).click();
  await expect(page.getByRole("button", { name: /sound on/i })).toHaveAttribute("aria-pressed", "true");
});

test("dates appear only on the posters", async ({ page }) => {
  await page.goto(URL);
  const stray = await page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.querySelector("article")!, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\b\d{2}\.\d{4}\b/.test(n.textContent!) && !n.parentElement!.closest(".mc-poster")) out.push(n.textContent!);
    return out;
  });
  expect(stray).toEqual([]);
});

test("no glow added anywhere", async ({ page }) => {
  await page.goto(URL);
  await noAddedGlow(page);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("nothing animates and the hero shows its poster", async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await page.locator(".rel-video").evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });
});

test.describe("a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
  test("no sideways scroll, the menu opens full screen, the floors hold", async ({ page }) => {
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: /menu/i }).click();
    const menu = page.getByRole("dialog", { name: /menu/i });
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(389);
    await page.getByRole("button", { name: /close/i }).click();
    await expectTextFloors(page);
  });
});

test("axe finds nothing serious", async ({ page }) => {
  await page.goto(URL);
  const { violations } = await new AxeBuilder({ page }).include("article").analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});
