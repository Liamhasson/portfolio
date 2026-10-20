import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, expectNoSeriousA11y, expectTextFloors } from "./cs-helpers";

/** The Marni Came case study (spec 2026-10-20 §3; plan Tasks 6–7). */
const URL = "/marni-came";

async function noAddedGlow(page: Page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll("article[data-world='marni-came'] *")].flatMap((el) => {
    if (el.closest(".pu")) return []; // (Pulse's own world, peeking in)
    const s = getComputedStyle(el);
    const blurred = s.boxShadow !== "none" && s.boxShadow.split(/,(?![^(]*\))/).some((sh) => { const n = sh.match(/(-?\d*\.?\d+)px/g) ?? []; return n.length >= 3 && parseFloat(n[2]) > 0; });
    return s.textShadow !== "none" || blurred ? [`${el.tagName}.${el.className}`] : [];
  }));
  expect(bad).toEqual([]);
}

test("the switch: four moves, off at load, each one toggles and changes the picture", async ({ page }) => {
  await page.goto(URL);
  const group = page.getByRole("group", { name: "The four moves" });
  for (const m of ["Slice", "Burn", "Doubled", "Lens"]) await expect(group.getByRole("button", { name: new RegExp(`^${m}`) })).toHaveAttribute("aria-pressed", "false");
  const canvas = page.locator(".mc-switch canvas");
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const before = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await group.getByRole("button", { name: /^Burn/ }).click();
  await expect(group.getByRole("button", { name: /^Burn/ })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(700);
  const after = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  expect(after).not.toBe(before);
});

test("the idea's word cycles every 1.6 s", async ({ page }) => {
  await page.goto(URL);
  const word = page.locator(".mc-cyc");
  await expect(word).toHaveText("Broken");
  await expect(word).toHaveText("Burned", { timeout: 2500 });
});

test("sound starts off, nothing plays, the hero video is muted", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("button", { name: /sound off/i })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused))).toBe(false);
  expect(await page.locator(".mc-hero-video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
});

test("no glow added anywhere, floors and contrast hold at 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL);
  await noAddedGlow(page);
  await expectTextFloors(page);
  await expectNoSeriousA11y(page);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the word stays on Broken", async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(2200);
    await expect(page.locator(".mc-cyc")).toHaveText("Broken");
  });
});

test.describe("a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
  test("no sideways scroll; floors hold", async ({ page }) => {
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await expectTextFloors(page);
  });
});
