import { expect, test, type Page } from "@playwright/test";

/** The prototype's test hook (docs/prototypes/pulse-mockups/onboarding-proto.js). */
type Choices = {
  goals: string[];
  activities: string[];
  workout: string | null;
  studio: string | null;
  day: string | null;
  time: string | null;
  trainer: string | null;
};
type ProtoState = { open: boolean; screen: number; settled: boolean; hinting: boolean; choices: Choices };
declare global {
  interface Window { __pulseProto: { state(): ProtoState } }
}

const proto = (page: Page) => page.getByRole("dialog", { name: "Pulse onboarding prototype" });
/** The screen on show: the coded app screens are real HTML, so text and controls are asserted directly. */
const current = (page: Page) => proto(page).locator(".pa-screen.is-current");
const state = (page: Page) => page.evaluate(() => window.__pulseProto.state());
const settledOn = (page: Page, screen: number) =>
  page.waitForFunction((s) => {
    const st = window.__pulseProto.state();
    return st.screen === s && st.settled;
  }, screen);
/** Back, Skip and the progress bar: one layer over the screens that stays put while they slide. */
const chrome = (page: Page) => proto(page).locator(".pa-chrome");
const btn = (page: Page, name: string | RegExp) =>
  proto(page).locator(".pa-screen.is-current, .pa-chrome")
    .getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
const tap = async (page: Page, name: string | RegExp, screen: number) => {
  await btn(page, name).click();
  await settledOn(page, screen);
};
const openProto = async (page: Page) => {
  await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
  await settledOn(page, 1);
};
/** Welcome → … → the screen given, picking as the Figma file does: Get stronger, HIIT, then HIIT · Burn Club ·
 *  Mon 1st · Maya Thompson. The prototype starts with nothing picked, so each screen's pick comes before its step. */
const walkTo = async (page: Page, to: number) => {
  const steps: [(string | RegExp)[], number][] = [
    [["Get Started"], 2], [["Get stronger", "Continue"], 3], [["HIIT", "Continue"], 4], [["Continue"], 5],
  ];
  const from = (await state(page)).screen;
  for (const [names, s] of steps) {
    if (s > to) return;
    if (s <= from) continue;
    for (const n of names.slice(0, -1)) await btn(page, n).click();
    await tap(page, names[names.length - 1], s);
  }
  if (to < 6) return;
  await tap(page, "HIIT", 6);
  if (to < 7) return;
  await tap(page, /^Burn Club/, 7);
  if (to < 8) return;
  await btn(page, "Mon 1st").click();
  await tap(page, /^Maya Thompson/, 8);
};
const EMPTY = { goals: [], activities: [], workout: null, studio: null, day: null, time: null, trainer: null };
/** Drags the Book now knob by a share of the track, with the mouse, in small steps. */
const dragKnob = async (page: Page, share: number) => {
  const slider = btn(page, "Book now");
  const track = (await slider.boundingBox())!;
  const knob = (await slider.locator(".pa-knob").boundingBox())!;
  const x0 = knob.x + knob.width / 2, y = knob.y + knob.height / 2;
  const travel = track.width - knob.width;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + (travel * share * i) / steps, y);
  await page.mouse.up();
};

test.describe("pulse onboarding prototype", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pulse-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__pulseProto && window.__pulseStories?.desktop);
  });

  test("the button opens the prototype on the welcome screen, focus inside, page held still", async ({ page }) => {
    await openProto(page);
    await expect(proto(page)).toBeVisible();
    const s = await state(page);
    expect(s).toMatchObject({ open: true, screen: 1 });
    await expect(current(page)).toContainText("Every fitness activity");
    expect(await page.evaluate(() => document.querySelector('[role="dialog"]')!.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  });

  test("it opens unfilled: no goal, chip or day picked, Continue held on 2 and 3", async ({ page }) => {
    await openProto(page);
    expect((await state(page)).choices).toEqual(EMPTY);
    const pressed = await proto(page).locator("[data-goal], [data-chip], [data-day], [data-workout]")
      .evaluateAll((els) => els.filter((e) => e.getAttribute("aria-pressed") !== "false").length);
    expect(pressed).toBe(0);
    await tap(page, "Get Started", 2);
    await expect(btn(page, "Continue")).toBeDisabled();
    await tap(page, "Skip", 3);
    await expect(btn(page, /^Strength & Conditioning/)).toHaveAttribute("aria-expanded", "true"); // the open card is layout, not a pick
    await expect(btn(page, "Continue")).toBeDisabled();
    await btn(page, "Continue").click({ force: true });
    expect(await state(page)).toMatchObject({ screen: 3 });
    await btn(page, "Hyrox").click();
    await expect(btn(page, "Continue")).toBeEnabled();
    await btn(page, "Hyrox").click();
    await expect(btn(page, "Continue")).toBeDisabled();
    await tap(page, "Skip", 4); // Skip still works with nothing picked
  });

  test("the screens are coded, not pictures, and scale with the phone", async ({ page }) => {
    await openProto(page);
    await expect(proto(page).locator(".proto-shot, .proto-hots")).toHaveCount(0);
    await expect(proto(page).locator(".pa-screen")).toHaveCount(12);
    const screen = (await proto(page).locator(".proto-screen").boundingBox())!;
    const app = (await proto(page).locator(".pa").boundingBox())!;
    expect(Math.abs(app.width - screen.width)).toBeLessThan(1.5);
    expect(Math.abs(app.height - screen.height)).toBeLessThan(1.5);
  });

  test("tapping through the real controls reaches the end of the onboarding", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 8);
    await tap(page, "Book now", 9);
    await tap(page, "Done", 10);
    await tap(page, "Continue", 11);
    await tap(page, "Enable notifications", 12);
    await expect(proto(page)).toContainText("12 / 12");
    await expect(current(page)).toContainText("Welcome to Pulse");
  });

  test("Maybe later also reaches the end", async ({ page }) => {
    await openProto(page);
    await tap(page, "Get Started", 2);
    await tap(page, "Skip", 3);
    await tap(page, "Skip", 4);
    await tap(page, "Skip for now", 10);
    await tap(page, "Continue", 11);
    await tap(page, "Maybe later", 12);
  });

  test("Back returns where you came from, including after Skip for now", async ({ page }) => {
    await openProto(page);
    await tap(page, "Get Started", 2);
    await tap(page, "Skip", 3);
    await btn(page, "Boxing").click();
    await tap(page, "Continue", 4);
    await tap(page, "Skip for now", 10);
    await tap(page, "Back", 4);
    await tap(page, "Back", 3);
  });

  test("goals toggle; Continue holds while none is picked", async ({ page }) => {
    await openProto(page);
    await tap(page, "Get Started", 2);
    const stronger = btn(page, "Get stronger"), active = btn(page, "Stay active"), flexible = btn(page, "Become more flexible");
    for (const b of [stronger, active, flexible]) await expect(b).toHaveAttribute("aria-pressed", "false");
    await stronger.click();
    await active.click();
    await flexible.click();
    await expect(flexible).toHaveAttribute("aria-pressed", "true");
    expect((await state(page)).choices.goals).toEqual(["Get stronger", "Stay active", "Become more flexible"]);
    for (const b of [stronger, active, flexible]) await b.click();
    expect((await state(page)).choices.goals).toEqual([]);
    const cont = btn(page, "Continue");
    await expect(cont).toBeDisabled();
    await cont.click({ force: true });
    expect(await state(page)).toMatchObject({ screen: 2 });
    await btn(page, "Lose weight").press("Enter");
    await expect(cont).toBeEnabled();
    await tap(page, "Continue", 3);
  });

  test("activity categories open one at a time; chips toggle", async ({ page }) => {
    await openProto(page);
    await tap(page, "Get Started", 2);
    await tap(page, "Skip", 3);
    const strength = btn(page, /^Strength & Conditioning/), cardio = btn(page, /^Cardio & Endurance/), mind = btn(page, /^Mind & Body/);
    await expect(strength).toHaveAttribute("aria-expanded", "true");
    await expect(cardio).toHaveAttribute("aria-expanded", "false");
    for (const c of ["HIIT", "Hyrox", "Boxing"]) await expect(btn(page, c)).toHaveAttribute("aria-pressed", "false");

    await btn(page, "HIIT").click();
    await btn(page, "Hyrox").click();
    await btn(page, "Boxing").click();
    await btn(page, "HIIT").click();
    await expect(btn(page, "Boxing")).toHaveAttribute("aria-pressed", "true");
    await expect(btn(page, "HIIT")).toHaveAttribute("aria-pressed", "false");

    await cardio.click();
    await expect(cardio).toHaveAttribute("aria-expanded", "true");
    await expect(strength).toHaveAttribute("aria-expanded", "false");
    await expect(btn(page, "Boxing")).toHaveCount(0);
    await btn(page, "Running").click();
    await mind.press("Enter");
    await expect(mind).toHaveAttribute("aria-expanded", "true");
    await expect(cardio).toHaveAttribute("aria-expanded", "false");
    expect((await state(page)).choices.activities.sort()).toEqual(["Boxing", "Hyrox", "Running"]);
    await tap(page, "Continue", 4);
  });

  test("tapping a workout is the step forward: no Continue, straight to the studios", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 5);
    await expect(btn(page, "Continue")).toHaveCount(0);
    await tap(page, "Crossfit", 6);
    expect((await state(page)).choices.workout).toBe("Crossfit");
    await expect(current(page)).toContainText("Crossfit classes near you");
    await tap(page, "Back", 5);
    await expect(btn(page, "Crossfit")).toHaveAttribute("aria-pressed", "true"); // the pick is kept on the way back
    await btn(page, "Hyrox").press("Enter");
    await settledOn(page, 6);
    await expect(current(page)).toContainText("Hyrox classes near you");
  });

  test("Back, Skip and the progress bar stay put while the screen slides", async ({ page }) => {
    await openProto(page);
    await tap(page, "Get Started", 2);
    await btn(page, "Get stronger").click();
    await expect(proto(page).locator(".pa-back")).toHaveCount(1);
    await expect(proto(page).locator(".pa-skip")).toHaveCount(1);
    await expect(proto(page).locator(".pa-progress")).toHaveCount(1);
    const drift = await page.evaluate(async () => {
      const q = (s: string) => document.querySelector(`[data-proto] ${s}`)!;
      const parts = [".pa-back", ".pa-skip", ".pa-progress"].map(q);
      const start = parts.map((el) => el.getBoundingClientRect().x);
      const incoming = q('.pa-screen[data-screen="3"]');
      (q('.pa-screen[data-screen="2"] .pa-cta') as HTMLElement).click();
      let worst = 0, slid = 0;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        parts.forEach((el, k) => { worst = Math.max(worst, Math.abs(el.getBoundingClientRect().x - start[k])); });
        slid = Math.max(slid, incoming.getBoundingClientRect().x - q(".proto-screen").getBoundingClientRect().x);
      }
      return { worst, slid };
    });
    expect(drift.slid).toBeGreaterThan(20); // the screen itself did slide
    expect(drift.worst).toBeLessThan(0.5);  // the chrome did not
    await settledOn(page, 3);
    await btn(page, "HIIT").click();
    await tap(page, "Continue", 4);
    await expect(btn(page, "Skip")).toHaveCount(0); // 04 has no Skip in the file
    await expect(btn(page, "Back")).toBeVisible();
  });

  test("the progress bar fills a step on every screen from 2 to 8, screen 4 included", async ({ page }) => {
    await openProto(page);
    const bar = chrome(page).getByRole("progressbar", { name: "Onboarding progress" });
    await expect(bar).toBeHidden();
    const seen: number[] = [];
    const read = async () => {
      await expect(bar).toBeVisible();
      await page.waitForTimeout(500); // the fill eases with the slide
      const fill = await bar.evaluate((b) => {
        const r = b.getBoundingClientRect(), f = b.querySelector("i")!.getBoundingClientRect();
        return (Math.min(f.right, r.right) - r.left) / r.width;
      });
      seen.push(fill);
    };
    await tap(page, "Get Started", 2); await read();
    await btn(page, "Get stronger").click();
    await tap(page, "Continue", 3); await read();
    await btn(page, "HIIT").click();
    await tap(page, "Continue", 4); await read();
    await tap(page, "Continue", 5); await read();
    await tap(page, "HIIT", 6); await read();
    await tap(page, /^Burn Club/, 7); await read();
    await btn(page, "Mon 1st").click();
    await tap(page, /^Maya Thompson/, 8); await read();
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1] + 0.05);
    expect(seen[seen.length - 1]).toBeGreaterThan(0.97);
    await tap(page, "Book now", 9);
    await expect(bar).toBeHidden();
  });

  test("the choices carry through to the studio, time, confirmation and booked screens", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 5);
    await tap(page, "Hyrox", 6);
    await expect(current(page)).toContainText("Hyrox classes near you");
    await tap(page, /^Iron Yard/, 7);
    await expect(current(page)).toContainText("Iron Yard · Hyrox");
    const mon = btn(page, "Mon 1st"), tue = btn(page, "Tue 2nd");
    await expect(mon).toHaveAttribute("aria-pressed", "false");
    await mon.click();
    await expect(mon).toHaveAttribute("aria-pressed", "true");
    await tue.click();
    await expect(tue).toHaveAttribute("aria-pressed", "true");
    await expect(mon).toHaveAttribute("aria-pressed", "false");
    await tap(page, /^Leon Smith/, 8);
    const confirm = current(page);
    await expect(confirm).toContainText("Hyrox");
    await expect(confirm).toContainText("Iron Yard · Berlin");
    await expect(confirm).toContainText("Tue, Dec 2");
    await expect(confirm).toContainText("12:00 – 12:45");
    await expect(confirm).toContainText("Leon S.");
    await expect(confirm).toContainText("Free cancellation up to 12 hours before");
    expect((await state(page)).choices).toMatchObject({ workout: "Hyrox", studio: "Iron Yard", day: "Tue, Dec 2", time: "12:00", trainer: "Leon Smith" });
    await tap(page, "Book now", 9);
    await expect(current(page)).toContainText("Hyrox at Iron Yard · Tue, Dec 2 · 12:00");
  });

  test("before a day is picked the slots are dimmed and off; a tap on one points at the days", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 7);
    const slots = proto(page).locator('.pa-screen[data-screen="7"] .pa-slot');
    await expect(slots).toHaveCount(7);
    for (const el of await slots.all()) {
      await expect(el).toHaveAttribute("aria-disabled", "true");
      await expect(el).toHaveAttribute("tabindex", "-1");
    }
    expect(await slots.first().evaluate((e) => parseFloat(getComputedStyle(e).opacity))).toBeLessThan(0.7);
    expect(await proto(page).locator('.pa-screen[data-screen="7"] [data-day][aria-pressed="true"]').count()).toBe(0);
    await btn(page, /^Maya Thompson/).click({ force: true });
    await expect(proto(page).locator(".pa-screen.is-current .pa-days")).toHaveClass(/is-nudge/);
    expect(await state(page)).toMatchObject({ screen: 7, hinting: false }); // the days, not the general hint
    await btn(page, "Mon 1st").click();
    await expect(btn(page, /^Maya Thompson/)).toBeEnabled();
    await expect(btn(page, /^Maya Thompson/)).not.toHaveAttribute("tabindex", "-1");
    for (const name of [/^Mark Adams/, /^Tory Green/, /^Elena Rodriguez/]) await expect(btn(page, name)).toBeDisabled();
    await expect.poll(() => btn(page, /^Maya Thompson/).evaluate((e) => parseFloat(getComputedStyle(e).opacity))).toBeGreaterThan(0.95); // lit, as it fades up
    await tap(page, /^Maya Thompson/, 8);
    expect((await state(page)).choices).toMatchObject({ day: "Mon, Dec 1", time: "11:00", trainer: "Maya Thompson" });
  });

  test("fully booked slots are disabled; a tap that misses shows where the controls are", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 7);
    await btn(page, "Mon 1st").click();
    for (const name of [/^Mark Adams/, /^Tory Green/, /^Elena Rodriguez/]) {
      await expect(btn(page, name)).toBeDisabled();
      await expect(btn(page, name)).toHaveAttribute("tabindex", "-1");
    }
    await expect(btn(page, /^Maya Thompson/)).toBeEnabled();
    await expect(btn(page, /^Maya Thompson/)).toContainText("1 spot left");
    await expect(current(page)).not.toContainText("1 spots left");
    const screen = proto(page).locator(".proto-screen");
    const box = (await screen.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * ((280 + 38) / 852)); // Mark Adams, fully booked
    expect(await state(page)).toMatchObject({ screen: 7, hinting: true });
    await expect(screen).toHaveClass(/is-hinting/);
  });

  test("Book now: released early it springs back, dragged past 85% it books", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 8);
    await dragKnob(page, 0.5);
    await page.waitForTimeout(700);
    expect(await state(page)).toMatchObject({ screen: 8, settled: true });
    const x = await current(page).locator(".pa-knob").evaluate((k) => new DOMMatrix(getComputedStyle(k).transform).m41);
    expect(Math.abs(x)).toBeLessThan(1);
    await dragKnob(page, 0.92);
    await settledOn(page, 9);
    expect((await state(page)).choices.time).toBe("11:00");
  });

  test("Book now: the knob follows the pointer while dragged", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 8);
    const slider = btn(page, "Book now");
    const knob = slider.locator(".pa-knob");
    const k = (await knob.boundingBox())!;
    await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
    await page.mouse.down();
    await page.mouse.move(k.x + k.width / 2 + 40, k.y + k.height / 2, { steps: 5 });
    const moved = (await knob.boundingBox())!;
    expect(moved.x - k.x).toBeGreaterThan(36);
    expect(moved.x - k.x).toBeLessThan(44);
    await page.mouse.up();
  });

  test("Book now: a tap plays the slide and books; so does Enter", async ({ page }) => {
    await openProto(page);
    await walkTo(page, 8);
    await btn(page, "Book now").click();
    expect((await state(page)).screen).toBe(8); // the slide plays first
    await settledOn(page, 9);
    await proto(page).getByRole("button", { name: "Restart" }).click(); // 09 has no Back in the file
    await settledOn(page, 1);
    await walkTo(page, 8);
    await btn(page, "Book now").focus();
    await page.keyboard.press("Enter");
    await settledOn(page, 9);
  });

  test("Esc closes and returns focus to the button; Restart starts over with nothing picked", async ({ page }) => {
    const trigger = page.locator('.ob[data-story="desktop"] [data-proto-open]');
    await openProto(page);
    await tap(page, "Get Started", 2);
    await btn(page, "Lose weight").click();
    await btn(page, "Get stronger").click();
    await proto(page).getByRole("button", { name: "Restart" }).click();
    await settledOn(page, 1);
    expect((await state(page)).choices).toEqual(EMPTY);
    await page.keyboard.press("Escape");
    await expect(proto(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");    await trigger.click(); // reopening starts over too
    await settledOn(page, 1);
    expect((await state(page)).choices).toEqual(EMPTY);
  });

  test("Tab stays inside the prototype and only reaches the screen on show", async ({ page }) => {
    await openProto(page);
    await tap(page, "Get Started", 2);
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const a = document.activeElement!;
        const s = a.closest(".pa-screen");
        return { inside: document.querySelector('[role="dialog"]')!.contains(a), offScreen: !!s && !s.classList.contains("is-current") };
      });
      expect(where).toEqual({ inside: true, offScreen: false });
    }
  });
});

test.describe("pulse onboarding prototype, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("opens from the still grid, changes screens instantly and books without the slide", async ({ page }) => {
    await page.goto("/pulse-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__pulseProto && window.__pulseStories?.desktop);
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    await btn(page, "Get Started").click();
    expect(await state(page)).toMatchObject({ open: true, screen: 2, settled: true });
    await walkTo(page, 8);
    await btn(page, "Book now").click();
    expect(await state(page)).toMatchObject({ screen: 9, settled: true });
  });
});
