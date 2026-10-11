import { expect, test, type Page } from "@playwright/test";

/** The Pulse board's test hook (docs/prototypes/pulse-mockups/onboarding-story.js). */
/** Where the scripted user is on the screen on show: seconds into its play, the steps done, the tap times. */
type Step = { screen: number; t: number; done: string[]; tap: boolean; taps: number[]; playing: boolean };
type PulseState = {
  beat: number; settled: boolean; visible: number[]; caption: number; stage: number;
  fills: number[]; step: Step; static?: boolean; screens?: number;
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
/** The coded screen in a story's figure n (1-based). */
const fig = (page: Page, n: number, name = "desktop") => page.locator(`.ob[data-story="${name}"] .ob-screen`).nth(n - 1);
const pressed = (page: Page, n: number, sel: string) => fig(page, n).locator(sel);
/** Waits for the scripted user to have done a step on the screen on show (it plays on its own clock). */
const doneWith = (page: Page, name: string, story = "desktop") =>
  page.waitForFunction(([s, n]) => window.__pulseStories[s].state().step.done.includes(n), [story, name] as const, { timeout: 8000 });
const opacityOf = (l: ReturnType<Page["locator"]>) => l.evaluate((e) => parseFloat(getComputedStyle(e).opacity));

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
    for (let b = 0; b < 12; b++) { await story(page).go(b); await page.waitForTimeout(400); }
    await story(page).go(7);
    await doneWith(page, "Book now");
    expect(errors).toEqual([]);
  });

  test("the story's screens are the coded app, display only", async ({ page }) => {
    const ob = page.locator('.ob[data-story="desktop"]');
    await expect(ob.locator(".ob-screen .pa-screen")).toHaveCount(12);
    await expect(ob.locator(".ob-screen img[src*='onb-']")).toHaveCount(0);
    const live = await ob.locator(".ob-screen").evaluateAll((els) => els.filter((e) => !e.querySelector(".pa[inert]")).length);
    expect(live).toBe(0);
    await expect(ob.locator(".ob-chrome .pa-progress")).toHaveCount(1); // one Back / Skip / bar layer over the screens
    await expect(ob.getByRole("button", { name: "Tap through it yourself" })).toBeVisible();
  });

  test("screen 2 rests untouched first, then the goals are ticked at a person's pace", async ({ page }) => {
    const goal = (g: string) => pressed(page, 2, `[data-goal="${g}"]`);
    const cont = pressed(page, 2, ".pa-cta");
    await story(page).go(1);
    const arrived = Date.now();
    expect((await story(page).state()).step).toMatchObject({ screen: 2, done: [], playing: true });
    await expect(goal("Get stronger")).toHaveAttribute("aria-pressed", "false");
    await expect(goal("Stay active")).toHaveAttribute("aria-pressed", "false");
    await expect(cont).toHaveAttribute("aria-disabled", "true");
    await doneWith(page, "Get stronger");
    expect(Date.now() - arrived).toBeGreaterThan(1000); // it rests, untouched, before the first tap
    await doneWith(page, "Continue");
    await expect(goal("Get stronger")).toHaveAttribute("aria-pressed", "true");
    await expect(goal("Stay active")).toHaveAttribute("aria-pressed", "true");
    await expect(cont).not.toHaveAttribute("aria-disabled", "true");
  });

  test("the rhythm is the clock's, not the scroll's: arriving deep in a screen's scroll still starts it untouched", async ({ page }) => {
    await story(page).go(1, 0.97);
    expect((await story(page).state()).step.done).toEqual([]);
    await expect(pressed(page, 2, '[data-goal="Get stronger"]')).toHaveAttribute("aria-pressed", "false");
  });

  test("scrolling back to a screen plays it again from untouched", async ({ page }) => {
    await story(page).go(1);
    await doneWith(page, "Continue");
    await story(page).go(2);
    await story(page).go(1);
    expect((await story(page).state()).step.done).toEqual([]);
    await expect(pressed(page, 2, '[data-goal="Get stronger"]')).toHaveAttribute("aria-pressed", "false");
    await doneWith(page, "Stay active");
  });

  test("left alone, a screen's last tap moves the story on, as the tap would in the app", async ({ page }) => {
    await story(page).go(1);
    const y0 = await page.evaluate(() => scrollY);
    await page.waitForFunction(() => window.__pulseStories.desktop.state().beat === 2, undefined, { timeout: 8000 });
    const s = await story(page).state();
    expect(s.caption).toBe(2);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y0); // the scroll keeps up, so a scroll after carries on from here
    await expect(fig(page, 2).locator('[data-goal="Stay active"]')).toHaveAttribute("aria-pressed", "true"); // left as the user left it
    await page.waitForFunction(() => window.__pulseStories.desktop.state().beat === 3, undefined, { timeout: 8000 });
  });

  test("the story doesn't move the page while the tap-through prototype is open", async ({ page }) => {
    await story(page).go(1);
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    const y = await page.evaluate(() => scrollY);
    await page.waitForTimeout(4500);
    expect(await page.evaluate(() => scrollY)).toBe(y);
    expect((await story(page).state()).beat).toBe(1);
  });

  test("the last screen stays: nothing moves on after 12", async ({ page }) => {
    await story(page).go(11);
    await page.waitForTimeout(3000);
    expect((await story(page).state()).beat).toBe(11);
  });

  test("nothing plays while the story is off screen; it starts when the phone pins", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2500);
    expect((await story(page).state()).step).toMatchObject({ screen: 1, done: [], playing: false });
    await story(page).go(0);
    await doneWith(page, "Get Started");
  });

  test("screen 3: Strength is open; HIIT, then Hyrox, are ticked", async ({ page }) => {
    await story(page).go(2);
    await expect(pressed(page, 3, ".pa-cat-head").first()).toHaveAttribute("aria-expanded", "true");
    for (const c of ["HIIT", "Hyrox"]) await expect(pressed(page, 3, `[data-chip="${c}"]`)).toHaveAttribute("aria-pressed", "false");
    await expect(pressed(page, 3, ".pa-cta")).toHaveAttribute("aria-disabled", "true");
    await doneWith(page, "Continue");
    for (const c of ["HIIT", "Hyrox"]) await expect(pressed(page, 3, `[data-chip="${c}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(pressed(page, 3, ".pa-cta")).not.toHaveAttribute("aria-disabled", "true");
  });

  test("the tap mark presses on the control just before it changes, and is gone at rest", async ({ page }) => {
    await story(page).go(1);
    const mark = fig(page, 2).locator(".pa-tap");
    expect(await opacityOf(mark)).toBe(0);
    await page.waitForFunction(() => {
      const st = window.__pulseStories.desktop.state().step;
      return st.tap && st.done.length === 0 && parseFloat(getComputedStyle(document.querySelectorAll('.ob[data-story="desktop"] .ob-screen')[1].querySelector(".pa-tap")!).opacity) > 0.5;
    });
    const m = (await mark.boundingBox())!, t = (await pressed(page, 2, '[data-goal="Get stronger"]').boundingBox())!;
    const cx = m.x + m.width / 2, cy = m.y + m.height / 2;
    expect(cx > t.x && cx < t.x + t.width && cy > t.y && cy < t.y + t.height).toBe(true);
    await page.waitForFunction(() => window.__pulseStories.desktop.state().beat === 2, undefined, { timeout: 8000 }); // it moved on
    expect(await opacityOf(mark)).toBe(0);
  });

  test("screen 7: the slots wait, dimmed, until Mon 1st is tapped, then light up", async ({ page }) => {
    const maya = pressed(page, 7, '[data-slot="3"]');
    await story(page).go(6);
    await expect(pressed(page, 7, '[data-day="Mon, Dec 1"]')).toHaveAttribute("aria-pressed", "false");
    await expect(maya).toHaveAttribute("aria-disabled", "true");
    await expect.poll(() => opacityOf(maya)).toBeLessThan(0.7);
    await doneWith(page, "Mon 1st");
    await expect(pressed(page, 7, '[data-day="Mon, Dec 1"]')).toHaveAttribute("aria-pressed", "true");
    await expect(maya).not.toHaveAttribute("aria-disabled", "true");
    await expect.poll(() => opacityOf(maya)).toBeGreaterThan(0.95);
    await expect(pressed(page, 7, '[data-slot="0"]')).toHaveAttribute("aria-disabled", "true"); // fully booked stays off
  });

  test("screen 8: the Book now knob slides on its own, the finger riding it", async ({ page }) => {
    const MAX = 345 - 52 - 2;
    await story(page).go(7);
    const knobX = () => pressed(page, 8, ".pa-knob").evaluate((k) => new DOMMatrix(getComputedStyle(k).transform).m41);
    expect(await knobX()).toBeLessThan(1);
    await page.waitForFunction((max) => {
      const k = document.querySelectorAll('.ob[data-story="desktop"] .ob-screen')[7].querySelector(".pa-knob")!;
      const x = new DOMMatrix(getComputedStyle(k).transform).m41;
      return x > max * 0.2 && x < max * 0.8 && window.__pulseStories.desktop.state().step.tap;
    }, MAX);
    await doneWith(page, "Book now");
    expect(await knobX()).toBeGreaterThan(MAX - 1);
  });

  test("the picks carry through: studio, time, confirmation, booked", async ({ page }) => {
    await story(page).go(5);
    await expect(fig(page, 6)).toContainText("HIIT classes near you");
    await story(page).go(6);
    await expect(fig(page, 7)).toContainText("Burn Club · HIIT");
    await story(page).go(7);
    for (const t of ["HIIT", "Burn Club · Berlin", "Mon, Dec 1", "11:00 – 11:45", "Maya T."]) await expect(fig(page, 8)).toContainText(t);
    await story(page).go(8);
    await expect(fig(page, 9)).toContainText("HIIT at Burn Club · Mon, Dec 1 · 11:00");
  });

  test("Back, Skip and the bar hold still while the story's screen slides", async ({ page }) => {
    await story(page).go(2, 0.5);
    const drift = await page.evaluate(async () => {
      const ob = document.querySelector('.ob[data-story="desktop"]')!;
      const parts = [".pa-back", ".pa-progress"].map((s) => ob.querySelector(`.ob-chrome ${s}`)!);
      const start = parts.map((el) => el.getBoundingClientRect().x);
      window.__pulseStories.desktop.scrollToBeat(3, 0.1);
      let worst = 0;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        parts.forEach((el, k) => { worst = Math.max(worst, Math.abs(el.getBoundingClientRect().x - start[k])); });
      }
      return worst;
    });
    expect(drift).toBeLessThan(0.5);
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
    await expect(page.locator('.ob[data-story="phone"] .ob-screen .pa-screen')).toHaveCount(12);
    await doneWith(page, "Mon 1st", "phone");
    await expect(fig(page, 7, "phone").locator('[data-day="Mon, Dec 1"]')).toHaveAttribute("aria-pressed", "true");
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
    // each screen as it ends: its picks made, no tap marks
    for (const g of ["Get stronger", "Stay active"]) await expect(story.locator(`.ob-screen [data-goal="${g}"]`)).toHaveAttribute("aria-pressed", "true");
    for (const c of ["HIIT", "Hyrox"]) await expect(story.locator(`.ob-screen [data-chip="${c}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(story.locator('.ob-screen [data-workout="HIIT"]')).toHaveAttribute("aria-pressed", "true");
    await expect(story.locator('.ob-screen [data-day="Mon, Dec 1"]')).toHaveAttribute("aria-pressed", "true");
    await expect(story.locator(".pa-tap")).toHaveCount(0);
    const knob = await story.locator(".ob-screen .pa-knob").evaluate((k) => new DOMMatrix(getComputedStyle(k).transform).m41);
    expect(knob).toBeGreaterThan(345 - 52 - 3);
  });
});
