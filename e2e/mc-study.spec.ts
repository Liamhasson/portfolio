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

test("every headline puts its red words on their own line, below the white (Liam, 2026-10-25)", async ({ page }) => {
  await page.goto(URL);
  for (const h of await page.locator(".mc-headline").all()) {
    const r = await h.evaluate((el) => {
      const red = el.querySelector(".mc-red")!.getBoundingClientRect();
      const range = document.createRange(); range.setStart(el.firstChild!, 0); range.setEnd(el.firstChild!, 1);
      const w = range.getBoundingClientRect();
      return { redTop: red.top, whiteTop: w.top, lineH: w.height, redLeft: red.left, left: el.getBoundingClientRect().left };
    });
    expect(r.redTop - r.whiteTop).toBeGreaterThan(r.lineH * 0.6);   // (a line below, not beside)
    expect(Math.abs(r.redLeft - r.left)).toBeLessThanOrEqual(2);
  }
});

test("the idea is one still line: no typing, no swapping (Liam, 2026-10-22)", async ({ page }) => {
  await page.goto(URL);
  const idea = page.locator(".mc-idea");
  await expect(idea).toHaveText("Nothing polished. Broken on purpose.");
  await page.waitForTimeout(2000);
  await expect(idea).toHaveText("Nothing polished. Broken on purpose.");
});

test("sound starts off, nothing plays, the hero video is muted", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("button", { name: "Audio" })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused))).toBe(false);
  expect(await page.locator(".mc-hero-video").evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
});

test("the audio button clears the nav's pills, at 1440 and 1024", async ({ page }) => {
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
    await expect(cols.locator("span")).toHaveText(["0A0908", "EEEAE2", "EC1302", "Screen blend mode"]);
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
    await expect(page.locator(".mc-idea")).toHaveText("Nothing polished. Broken on purpose.");
  });
});

test.describe("a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
  test("no sideways scroll; floors hold", async ({ page }) => {
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await expectTextFloors(page);
  });
  test("at a glance: role | timeline, team | impact, then the tools across, as on Nordic Logic (Liam, 2026-10-27)", async ({ page }) => {
    await page.goto(URL);
    const box = async (name: string) => (await page.locator(".strip > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${name}$`) }) }).boundingBox())!;
    const [role, timeline, team, impact, tools] = await Promise.all(["Role", "Timeline", "Team", "Impact", "Tools"].map(box));
    expect(timeline.y).toBeCloseTo(role.y, 0);
    expect(impact.y).toBeCloseTo(team.y, 0);
    expect(team.y).toBeGreaterThan(role.y);
    expect(tools.y).toBeGreaterThan(team.y);
    expect(tools.width).toBeGreaterThan(300);
  });
  test("the Problem's words sit on the same gutter as the other sections", async ({ page }) => {
    await page.goto(URL);
    const left = (sel: string) => page.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().left));
    expect(await left(".problem h2")).toBe(await left(".strategy h2"));
  });
});

test("nothing in the study is cut off at the screen's edges, from 320 to 1099 (Liam, 2026-10-27)", async ({ page }) => {
  for (const width of [320, 390, 768, 1099]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(URL);
    const cut = await page.evaluate((W) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll("article[data-world='marni-came'] *")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).position === "fixed") continue;
        if (r.right > W + 1 || r.left < -1) out.push(`${el.tagName}.${el.className} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
      }
      return out;
    }, width);
    expect(cut, `${width}`).toEqual([]);
  }
});

test("identity: three logo versions, none of them red; the specimen has no words", async ({ page }) => {
  await page.goto(URL);
  const logos = page.locator(".mc-logos figure");
  await expect(logos).toHaveCount(3);
  const reds = await page.evaluate(() => [...document.querySelectorAll(".mc-logos *")].filter((el) => { const s = getComputedStyle(el); return s.color === "rgb(236, 19, 2)" || s.fill === "rgb(236, 19, 2)"; }).length);
  expect(reds).toBe(0);
  for (const t of await page.locator(".mc-spec-serif, .mc-spec-sans").allInnerTexts()) expect(t.replace(/\s/g, "")).toMatch(/^[A-Z0-9·/—&]+$/);
});

test("imagery: twelve pictures at most, every move among them, each tagged (Liam, 2026-10-25)", async ({ page }) => {
  await page.goto(URL);
  const figs = page.locator(".mc-grid figure");
  expect(await figs.count()).toBeLessThanOrEqual(12);
  const tags = new Set(await page.locator(".mc-grid figcaption").allInnerTexts());
  for (const m of ["BURN", "DOUBLED", "LENS", "BLOWOUT"]) expect([...tags].map((t) => t.toUpperCase())).toContain(m);
  await expect(page.locator("section.imagery")).toContainText("never on type");
});

test("pictures have rounded corners; the edge-to-edge hero stays square", async ({ page }) => {
  await page.goto(URL);
  expect(await page.locator(".mc-grid figure").first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThan(0);
  expect(await page.locator(".mc-hero-video").evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("0px");
});

test("applications: the cover, and no posters until Liam's own are ready (10-25)", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator(".mc-cover")).toBeVisible();
  await expect(page.locator(".applications .mc-poster")).toHaveCount(0);
});

test("the stage flag is shown whole: its picture never outgrows its tile", async ({ page }) => {
  for (const width of [1000, 1440, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(URL);
    const tile = page.locator(".mc-collage .a1");
    await tile.scrollIntoViewIfNeeded();
    const [f, i] = await tile.evaluate((el) => [el, el.querySelector("img")!].map((e) => e.getBoundingClientRect().height));
    expect(i).toBeLessThanOrEqual(f + 1);
  }
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
  await expect(page.getByRole("button", { name: "Audio" })).toHaveAttribute("aria-pressed", "true");
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
    expect(widths.length).toBe(4);   // the cover, the flag and the two shirts (Liam 2026-10-25)
    for (const w of widths) expect(w).toBeGreaterThan(150);
  });
});

test.describe("the audio button (Liam 2026-10-26, after lusion.co)", () => {
  test("off: a flat line and the word Audio at the bottom centre; nothing loads until it's clicked", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (r) => { if (/\.energy\.json/.test(r.url())) asked.push(r.url()); });
    for (const [w, h, gap] of [[1440, 900, 24], [390, 844, 16]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(URL);
      const b = (await page.locator(".mc-audio").boundingBox())!;
      expect(Math.abs(b.x + b.width / 2 - w / 2)).toBeLessThan(2);
      expect(Math.abs(h - (b.y + b.height) - gap)).toBeLessThan(2);
      await expect(page.locator(".mc-audio-w")).toHaveText("Audio");
      await expect(page.locator(".mc-audio-w")).toBeVisible();
      expect(await page.locator(".mc-audio path").getAttribute("d")).toBe("M17,24 H31");
    }
    await page.waitForTimeout(400);
    expect(asked).toHaveLength(0);
  });

  test("on: the word goes, the circle takes the burn colour and its line draws the waveform; off brings the flat line back", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL);
    const btn = page.locator(".mc-audio");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.locator(".mc-audio-w").evaluate((e) => e.getBoundingClientRect().width)).toBeLessThan(1);
    const fill = () => page.locator(".mc-audio-c").evaluate((e) => getComputedStyle(e).backgroundColor);
    await expect.poll(fill, { timeout: 8000 }).toMatch(/^rgba?\((1[3-9]\d|2\d\d), /);   // a burn amber, not the dark off state
    const d1 = await page.locator(".mc-audio path").getAttribute("d");
    expect(d1).toContain("C");
    await page.waitForTimeout(600);
    expect(await page.locator(".mc-audio path").getAttribute("d")).not.toBe(d1);   // it scrolls as the song plays
    const b = (await btn.boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThan(2);   // the circle alone, still centred
    await btn.click();
    await expect.poll(() => page.locator(".mc-audio path").getAttribute("d"), { timeout: 3000 }).toBe("M17,24 H31");
    await expect(page.locator(".mc-audio-w")).toBeVisible();
  });
});
