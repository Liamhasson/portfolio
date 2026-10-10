import { expect, test, type Page } from "@playwright/test";

const site = (page: Page) => page.locator('.story[data-story="desktop"] .site');

test.describe("markup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
  });

  test("all four chapters of the shipped site are there", async ({ page }) => {
    for (const ch of ["why", "risk", "attack", "powers"]) {
      await expect(site(page).locator(`[data-chapter="${ch}"]`)).toHaveCount(1);
    }
    await expect(site(page).locator(".chap[data-go]")).toHaveText([
      "Why it matters", "The risk is real", "Real-world attack", "What powers us",
    ]);
  });

  test("What powers us uses the live site's words exactly", async ({ page }) => {
    const powers = site(page).locator('[data-chapter="powers"]');
    await expect(powers.locator("h4")).toHaveText("WHAT POWERS US");
    await expect(powers.locator(".s-head p")).toHaveText("Three proprietary engines");
    await expect(powers.locator(".eng h5")).toHaveText(["OPR", "TIAO", "DAN"]);
    await expect(powers.locator(".eng-x")).toHaveText([
      "(Optical Phishing Recognition)",
      "(Threat Intelligence Autonomous Operation)",
      "(Data Analysis NLU)",
    ]);
    await expect(powers.locator(".eng-d")).toHaveText([
      "AI driven visual phishing detection",
      "Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched.",
      "Context-aware language model that understands behavioral patterns across human and AI agents.",
    ]);
  });

  test("the attack chapter carries the three approved captions and a paused video", async ({ page }) => {
    const attack = site(page).locator('[data-chapter="attack"]');
    await expect(attack.locator(".s-caps li")).toHaveText([
      "A link lands in the call.", "Cyvore reads it.", "Blocked.",
    ]);
    await expect(attack.locator("video")).not.toHaveAttribute("autoplay", /.*/);
    await expect(attack.locator("video")).not.toHaveAttribute("data-inview", /.*/);
  });

  test("panel text is readable: 13px at the 1440 frame", async ({ page }) => {
    const px = await page.evaluate(() => {
      const desc = document.querySelector('.story[data-story="desktop"] .pan-desc') as HTMLElement;
      const frame = desc.closest(".frame") as HTMLElement;
      return parseFloat(getComputedStyle(desc).fontSize) / (frame.getBoundingClientRect().width / 1440);
    });
    expect(px).toBeCloseTo(13, 0);
  });

  test("the pin can stick: sticky pin, frames clip instead of hiding overflow", async ({ page }) => {
    const styles = await page.evaluate(() => {
      const pin = document.querySelector('.story[data-story="desktop"] .story-pin') as HTMLElement;
      return {
        pin: getComputedStyle(pin).position,
        frame: getComputedStyle(pin.closest(".frame")!).overflow,
        f: getComputedStyle(pin.closest(".f")!).overflow,
      };
    });
    expect(styles).toEqual({ pin: "sticky", frame: "clip", f: "clip" });
  });
});

type State = {
  beat: number; chapter: string; settled: boolean; visible: string[];
  open: { why: number; risk: number }; fill: Record<string, number>;
  caption: number; lit: number[]; statText: string | null;
};

const story = (page: Page, name = "desktop") => ({
  state: () => page.evaluate((n) => (window as any).__cyvoreStories[n].state(), name) as Promise<State>,
  go: async (beat: number, within = 0.5) => {
    await page.evaluate(([n, b, w]) => (window as any).__cyvoreStories[n].scrollToBeat(b, w), [name, beat, within] as const);
    await page.waitForFunction(([n, b]) => {
      const s = (window as any).__cyvoreStories[n].state();
      return s.beat === b && s.settled;
    }, [name, beat] as const);
  },
});

test.describe("beats", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
  });

  test("the site arrives with every column closed", async ({ page }) => {
    await story(page).go(0, 0.5);
    const s = await story(page).state();
    expect(s.chapter).toBe("why");
    expect(s.open.why).toBe(-1);
  });

  test("each beat of Why it matters opens the next column", async ({ page }) => {
    for (const [beat, col] of [[1, 0], [2, 1], [3, 2], [4, 3]] as const) {
      await story(page).go(beat);
      expect((await story(page).state()).open.why).toBe(col);
    }
  });

  test("The risk is real opens its statistics in turn and counts each one up to its value", async ({ page }) => {
    await story(page).go(7);
    await page.waitForTimeout(1500);
    const s = await story(page).state();
    expect(s.chapter).toBe("risk");
    expect(s.open.risk).toBe(2);
    expect(s.statText).toBe("967%");
  });

  test("the bar fills with the story and marks finished chapters", async ({ page }) => {
    await story(page).go(6, 0.5);
    const s = await story(page).state();
    expect(s.fill.why).toBe(1);
    expect(s.fill.risk).toBeCloseTo(0.375, 2);
    expect(s.fill.attack).toBe(0);
    await expect(page.locator('.story[data-story="desktop"] .chap[data-go="why"]')).toHaveAttribute("data-done", "");
  });

  test("a column the visitor picks gives way to the next beat", async ({ page }) => {
    await story(page).go(2);
    // Click where it is on screen, as a mouse does: locator.click() would first scroll the
    // element into view, and inside a sticky pin that scroll moves the story itself.
    const box = (await page.locator('.story[data-story="desktop"] [data-chapter="why"] .pan[aria-label="Enables"]').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect((await story(page).state()).open.why).toBe(3);
    await story(page).go(3);
    expect((await story(page).state()).open.why).toBe(2);
  });
});
