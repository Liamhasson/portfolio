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
