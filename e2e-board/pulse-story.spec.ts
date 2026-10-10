import { expect, test, type Page } from "@playwright/test";

/** The Pulse board's test hook (docs/prototypes/pulse-mockups/onboarding-story.js). */
type PulseState = {
  beat: number; settled: boolean; visible: number[]; caption: number; stage: number;
  fills: number[]; static?: boolean; screens?: number;
};
type PulseApi = { state(): PulseState; scrollToBeat(beat: number, within?: number): void };
declare global {
  interface Window { __pulseStories: Record<string, PulseApi> }
}

const CAPTIONS = [
  "What Pulse is for, in three lines.",
  "Pick the goals that matter to you.",
  "Choose the activities; the plan follows.",
  "Your first booking, free to cancel.",
  "The best matches for your activities.",
  "Studios near you, with ratings.",
  "A slot that fits, with what's still free.",
  "Everything in one place before you book.",
  "Booked, and one tap to your calendar.",
  "What else Pulse does, in four lines.",
  "Notifications, asked for with a reason.",
  "In.",
];

const story = (page: Page, name = "desktop") => ({
  state: () => page.evaluate((n) => window.__pulseStories[n].state(), name),
  go: async (beat: number, within = 0.5) => {
    await page.evaluate(([n, b, w]) => window.__pulseStories[n].scrollToBeat(b, w), [name, beat, within] as const);
    await page.waitForFunction(([n, b]) => {
      const s = window.__pulseStories[n].state();
      return s.beat === b && s.settled;
    }, [name, beat] as const);
  },
});

test.describe("pulse board", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pulse-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__pulseStories?.desktop);
  });

  test("the twelve onboarding screens carry the approved captions, in order", async ({ page }) => {
    const story = page.locator('.ob[data-story="desktop"]');
    await expect(story.locator(".ob-screen")).toHaveCount(12);
    await expect(story.locator(".ob-cap")).toHaveText(CAPTIONS);
  });

  test("scrolling steps through the screens; the caption and stage follow", async ({ page }) => {
    for (const [beat, stage] of [[0, 0], [2, 0], [3, 1], [8, 1], [9, 2], [11, 2]] as const) {
      await story(page).go(beat);
      const s = await story(page).state();
      expect(s.visible).toEqual([beat]);
      expect(s.caption).toBe(beat);
      expect(s.stage).toBe(stage);
    }
  });

  test("the stage bar fills: finished stages full, the current one partial", async ({ page }) => {
    await story(page).go(5, 0.5);
    const s = await story(page).state();
    expect(s.fills[0]).toBe(1);
    expect(s.fills[1]).toBeGreaterThan(0.4);
    expect(s.fills[1]).toBeLessThan(0.6);
    expect(s.fills[2]).toBe(0);
  });

  test("a fast scroll never shows two screens at rest and never flashes one it passes", async ({ page }) => {
    await story(page).go(0);
    const jumps = await page.evaluate(async () => {
      const api = window.__pulseStories.desktop;
      const els = [...document.querySelectorAll('.ob[data-story="desktop"] .ob-screen')] as HTMLElement[];
      const read = () => els.map((e) => parseFloat(getComputedStyle(e).opacity));
      let prev = read();
      let worst = 0;
      let on = true;
      const tick = () => {
        const now = read();
        now.forEach((o, i) => { if (prev[i] < 0.05 && o > 0.9) worst++; });
        prev = now;
        if (on) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      for (const b of [2, 4, 6, 8, 10]) { api.scrollToBeat(b, 0.5); await new Promise((r) => setTimeout(r, 30)); }
      await new Promise((r) => setTimeout(r, 1200));
      on = false;
      return worst;
    });
    expect(jumps).toBe(0);
    expect((await story(page).state()).visible).toEqual([10]);
  });

  test("captions never overlap: the old one is gone before the new one shows", async ({ page }) => {
    await story(page).go(3);
    const both = await page.evaluate(async () => {
      const caps = [...document.querySelectorAll('.ob[data-story="desktop"] .ob-cap')] as HTMLElement[];
      window.__pulseStories.desktop.scrollToBeat(4, 0.5);
      let worst = 0;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 20));
        const shown = caps.filter((c) => parseFloat(getComputedStyle(c).opacity) > 0.15).length;
        worst = Math.max(worst, shown);
      }
      return worst;
    });
    expect(both).toBe(1);
  });

  test("no console errors while the whole onboarding plays", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    for (let b = 0; b < 12; b++) await story(page).go(b);
    expect(errors).toEqual([]);
  });

  test("what is seen stays within 8 screens (pinned scroll not counted)", async ({ page }) => {
    const screens = await page.evaluate(() => {
      const frames = [...document.querySelectorAll(".f")].filter((f) => !f.classList.contains("m"));
      const u = frames[0].getBoundingClientRect().width / 1440;
      const track = document.querySelector('.ob[data-story="desktop"] .ob-track') as HTMLElement;
      const pin = document.querySelector('.ob[data-story="desktop"] .ob-pin') as HTMLElement;
      const total = frames.reduce((s, f) => s + f.getBoundingClientRect().height, 0) - (track.offsetHeight - pin.offsetHeight);
      return total / (900 * u);
    });
    expect(screens).toBeLessThanOrEqual(8);
  });

  test("the phone tells the same onboarding", async ({ page }) => {
    await page.waitForFunction(() => window.__pulseStories?.phone);
    await story(page, "phone").go(6);
    const s = await story(page, "phone").state();
    expect(s.visible).toEqual([6]);
    expect(s.caption).toBe(6);
  });
});

test.describe("pulse board, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a still grid of all twelve screens with their captions, nothing pinned", async ({ page }) => {
    await page.goto("/pulse-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__pulseStories?.desktop);
    const s = await page.evaluate(() => window.__pulseStories.desktop.state());
    expect(s).toMatchObject({ static: true, screens: 12 });
    const story = page.locator('.ob[data-story="desktop"]');
    expect(await story.locator(".ob-pin").evaluate((el) => getComputedStyle(el).position)).toBe("static");
    const visible = await story.locator(".ob-screen").evaluateAll((els) => els.filter((e) => parseFloat(getComputedStyle(e).opacity) > 0.9).length);
    expect(visible).toBe(12);
  });
});
