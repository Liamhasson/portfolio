import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, expectNoSeriousA11y } from "./cs-helpers";

/** The Cyvore new website teaser (spec docs/superpowers/specs/2026-11-25-cyvore-new-website-teaser-design.md;
 *  plan Task 3): the site's live hero, held on its first screen, framed in a page that claims no results. */
const URL = "/cyvore-new";

/** The framed snapshot, once its page has loaded. */
async function site(page: Page) {
  await expect(page.locator(".cn-site iframe")).toBeVisible();
  const frame = page.frame({ url: /\/cyvore-new\/site\/index\.html/ });
  expect(frame).not.toBeNull();
  await frame!.waitForLoadState("load");
  return frame!;
}

async function noAddedGlow(page: Page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll("article *")].flatMap((el) => {
    const s = getComputedStyle(el);
    const blurred = s.boxShadow !== "none" && s.boxShadow.split(/,(?![^(]*\))/).some((sh) => { const n = sh.match(/(-?\d*\.?\d+)px/g) ?? []; return n.length >= 3 && parseFloat(n[2]) > 0; });
    return s.textShadow !== "none" || blurred ? [`${el.tagName}.${el.className}`] : [];
  }));
  expect(bad).toEqual([]);
}

test("desktop: the live hero, framed, holding on its first screen", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(URL);
  const f = await site(page);
  await expect(f.locator("#hero h1")).toContainText("workspace security");
  const box = (await page.locator(".cn-site iframe").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 2000);
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.6);   // (into the frame: its art, no link)
  for (const key of ["ArrowDown", "PageDown", "Space", "End"]) await page.keyboard.press(key);
  await page.waitForTimeout(1200);   // (the page's own pull would have carried it on by now)
  expect(await f.evaluate(() => scrollY)).toBe(0);
  await expect(f.locator("#hero")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("inside the frame nothing leads away", async ({ page }) => {
  await page.goto(URL);
  const f = await site(page);
  await f.locator("#hero a.btn").click({ force: true });
  await f.locator("nav a.navlink").first().click({ force: true });
  await f.locator("nav a.logo").click({ force: true });
  await page.waitForTimeout(500);
  expect(f.url()).toMatch(/\/cyvore-new\/site\/index\.html$/);
  await expect(f.locator('[role="dialog"]:not([hidden])')).toHaveCount(0);
  expect(page.url()).toMatch(/\/cyvore-new$/);
});

test("phones: the site's own portrait layout, and the frame follows the width both ways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  let f = await site(page);
  const fits = async () => {
    const [win, frame] = await Promise.all([page.locator(".cn-site .win").boundingBox(), page.locator(".cn-site iframe").boundingBox()]);
    expect(Math.abs(win!.width - frame!.width)).toBeLessThanOrEqual(1);
    return frame!;
  };
  const tall = await fits();
  expect(tall.height).toBeGreaterThan(tall.width);
  await expect(f.locator("#hero h1")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".cn-site.is-wide")).toBeVisible();
  await expect.poll(async () => { const b = (await page.locator(".cn-site iframe").boundingBox())!; return b.width > b.height; }).toBe(true);
  await fits();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cn-site.is-phone")).toBeVisible();
  f = await site(page);
  await expect.poll(async () => { const b = (await page.locator(".cn-site iframe").boundingBox())!; return b.height > b.width; }).toBe(true);
  await fits();
});

test("the page: in progress, no results, the way on", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto(URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cyvore · New website");
  await expect(page.locator("article .tag", { hasText: "In progress" })).toBeVisible();
  await expect(page.getByText("Full case study coming soon.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Next project: Nordic Logic/ })).toHaveAttribute("href", "/nordic-logic");
  await expect(page.getByRole("link", { name: /open the site/i })).toHaveCount(0);
  await expectNoSeriousA11y(page);
  await noAddedGlow(page);
  // (the snapshot's own requests for what it left out, scene/, may 404 inside the frame: not the portfolio's errors)
  expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});

test("the snapshot is kept out of search; the page is not", async ({ request }) => {
  const snap = await request.get("/cyvore-new/site/index.html");
  expect(snap.ok()).toBe(true);
  expect(snap.headers()["x-robots-tag"]).toContain("noindex");
  const teaser = await request.get(URL);
  expect(teaser.headers()["x-robots-tag"]).toBeUndefined();
});

test("reduced motion: the still of the first screen, with its text, stands in for the moving frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  const still = page.locator(".cn-site img");
  await expect(still).toBeVisible();
  await expect(page.locator(".cn-site iframe")).toHaveCount(0);
  expect(await still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1200);
  await expect(still).toHaveAttribute("alt", /Agentic workspace security/);
});

test("the link preview is the first screen's still", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/case-studies\/cyvore-new\/peek\.jpg$/);
});
