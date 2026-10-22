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
  for (const m of ["Burn", "Doubled", "Lens", "Blowout"]) await expect(group.getByRole("button", { name: new RegExp(`^${m}`) })).toHaveAttribute("aria-pressed", "false");
  const canvas = page.locator(".mc-switch canvas");
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const before = await canvas.screenshot();
  await group.getByRole("button", { name: /^Burn/ }).click();
  await expect(group.getByRole("button", { name: /^Burn/ })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(700);
  const after = await canvas.screenshot();
  expect(after.equals(before)).toBe(false);
});

test("the idea is one still line: no typing, no swapping (Liam, 2026-10-22)", async ({ page }) => {
  await page.goto(URL);
  const idea = page.locator(".mc-idea");
  await expect(idea).toHaveText("Broken on purpose.");
  await page.waitForTimeout(2000);
  await expect(idea).toHaveText("Broken on purpose.");
});

test("sound starts off, nothing plays, the hero video is muted", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("button", { name: /sound off/i })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused))).toBe(false);
  expect(await page.locator(".mc-hero-video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
});

test("the sound toggle clears the nav's pills, at 1440 and 1024", async ({ page }) => {
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(URL);
    const t = (await page.locator("[data-sound-toggle]").boundingBox())!;
    for (const pill of await page.locator("nav a, nav button").filter({ visible: true }).all()) {
      const b = await pill.boundingBox();
      if (!b) continue;
      const overlap = t.x < b.x + b.width && b.x < t.x + t.width && t.y < b.y + b.height && b.y < t.y + t.height;
      expect(overlap, `${width}: overlaps ${await pill.textContent()}`).toBe(false);
    }
  }
});

test("every colour shows its name and code the same way, fitting its column down to 390 (Liam, 2026-10-21)", async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(URL);
    const cols = page.locator(".mc-colours li");
    await expect(cols.locator("span")).toHaveText(["0A0908", "EEEAE2", "EC1302", "Screen"]);
    for (const el of await cols.locator("b, span").all()) await expect(el).toBeVisible();
    const clipped = await cols.evaluateAll((lis) =>
      lis.filter((li) => [...li.querySelectorAll("b, span")].some((t) => t.getBoundingClientRect().right > li.getBoundingClientRect().right + 1)).map((li) => li.textContent));
    expect(clipped, `${width}`).toEqual([]);
  }
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
    await expect(page.locator(".mc-idea")).toHaveText("Broken on purpose.");
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

test("identity: three logo versions, none of them red; the specimen has no words", async ({ page }) => {
  await page.goto(URL);
  const logos = page.locator(".mc-logos figure");
  await expect(logos).toHaveCount(3);
  const reds = await page.evaluate(() => [...document.querySelectorAll(".mc-logos *")].filter((el) => { const s = getComputedStyle(el); return s.color === "rgb(236, 19, 2)" || s.fill === "rgb(236, 19, 2)"; }).length);
  expect(reds).toBe(0);
  for (const t of await page.locator(".mc-spec-serif, .mc-spec-sans").allInnerTexts()) expect(t.replace(/\s/g, "")).toMatch(/^[A-Z0-9·/—&]+$/);
});

test("imagery: the four moves with Blowout's note, the moodboard of the video's doubles", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator(".mc-moves figure")).toHaveCount(4);
  await expect(page.locator(".mc-moves")).toContainText("On pictures only, never on type");
  await expect(page.locator(".mc-mood img")).toHaveCount(13);
});

test("applications: the cover and four posters, dated exactly as the files prove", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator(".mc-cover")).toBeVisible();
  const dates = await page.locator(".applications .mc-poster-info span:last-child").evaluateAll((els) => els.map((e) => e.firstChild!.textContent!.trim()));
  expect(dates).toEqual(["12.2023", "09.02.2024", "02.2023", "03.2022"]);
});

test("website at 1440: the site live in the page, and Listen inside it turns the page's sound on", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL);
  const frame = page.locator('iframe[src="/marni-came/site?embed=1"]');
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toBeVisible();
  await expect(page.getByRole("link", { name: /open the site/i })).toHaveAttribute("href", "/marni-came/site");
  const site = page.frameLocator('iframe[src="/marni-came/site?embed=1"]');
  await expect(site.getByRole("button", { name: /sound/i })).toHaveCount(0); // (the page holds the one control)
  // no smooth scroll inside the frame, so the wheel hands back to the page at the site's end
  const inner = page.frames().find((f) => f.url().includes("/marni-came/site"))!;
  expect(await inner.evaluate(() => document.documentElement.classList.contains("lenis"))).toBe(false);
  await site.getByRole("button", { name: /^listen$/i }).click();
  await expect(page.getByRole("button", { name: /sound on/i })).toHaveAttribute("aria-pressed", "true");
  const playing = await page.evaluate(() => (window as unknown as { __mcPlaying?: number }).__mcPlaying ?? null);
  expect(playing === null || playing <= 1).toBe(true);
});

test.describe("website on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
  test("no iframe: three stills and the link", async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator(".website iframe")).toHaveCount(0);
    await expect(page.locator(".mc-site-stills img")).toHaveCount(3);
    await expect(page.getByRole("link", { name: /open the site/i })).toBeVisible();
  });
});

test("the page stays within its 16.5-screen cap at 1440×900 (Strategy added, Liam 2026-10-21)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL);
  const screens = await page.evaluate(() => document.documentElement.scrollHeight / 900);
  expect(screens).toBeLessThanOrEqual(16.5);
});

test.describe("applications on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
  test("the collage stacks: every piece at least half the column wide", async ({ page }) => {
    await page.goto(URL);
    const widths = await page.locator(".mc-collage figure").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    expect(widths.length).toBe(2);   // the flag and the shirt (the wheatpaste went, Liam 2026-10-21)
    for (const w of widths) expect(w).toBeGreaterThan(150);
  });
});
