import { expect, test, type Page } from "@playwright/test";

/** The prototype's test hook (docs/prototypes/pulse-mockups/onboarding-proto.js). */
type ProtoState = { open: boolean; screen: number; settled: boolean; hinting: boolean };
declare global {
  interface Window { __pulseProto: { state(): ProtoState } }
}

const proto = (page: Page) => page.getByRole("dialog", { name: "Pulse onboarding prototype" });
const state = (page: Page) => page.evaluate(() => window.__pulseProto.state());
const tap = async (page: Page, name: string, screen: number) => {
  await proto(page).getByRole("button", { name, exact: true }).click();
  await page.waitForFunction((s) => {
    const st = window.__pulseProto.state();
    return st.screen === s && st.settled;
  }, screen);
};

test.describe("pulse onboarding prototype", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pulse-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__pulseProto && window.__pulseStories?.desktop);
  });

  test("the button opens the prototype on the welcome screen, focus inside, page held still", async ({ page }) => {
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    await expect(proto(page)).toBeVisible();
    const s = await state(page);
    expect(s).toMatchObject({ open: true, screen: 1 });
    expect(await page.evaluate(() => document.querySelector('[role="dialog"]')!.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  });

  test("tapping through the real controls reaches the end of the onboarding", async ({ page }) => {
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    await tap(page, "Get started", 2);
    await tap(page, "Continue", 3);
    await tap(page, "Continue", 4);
    await tap(page, "Continue", 5);
    await tap(page, "Continue", 6);
    await tap(page, "Burn Club", 7);
    await tap(page, "Maya Thompson, 11:00, 1 spot left", 8);
    await tap(page, "Book now", 9);
    await tap(page, "Done", 10);
    await tap(page, "Continue", 11);
    await tap(page, "Enable notifications", 12);
    await expect(proto(page)).toContainText("12 / 12");
  });

  test("Back returns where you came from, including after Skip for now", async ({ page }) => {
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    await tap(page, "Get started", 2);
    await tap(page, "Skip", 3);
    await tap(page, "Continue", 4);
    await tap(page, "Skip for now", 10);
    await tap(page, "Back", 4);
    await tap(page, "Back", 3);
  });

  test("a fully booked slot isn't a control; a tap that misses shows where the controls are", async ({ page }) => {
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    for (const [name, s] of [["Get started", 2], ["Continue", 3], ["Continue", 4], ["Continue", 5], ["Continue", 6], ["Burn Club", 7]] as const) await tap(page, name, s);
    await expect(proto(page).getByRole("button", { name: /Mark Adams/ })).toHaveCount(0);
    const screen = proto(page).locator(".proto-screen");
    const box = (await screen.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * ((280 + 38) / 852)); // Mark Adams, fully booked
    expect(await state(page)).toMatchObject({ screen: 7, hinting: true });
  });

  test("Esc closes and returns focus to the button; Restart starts over", async ({ page }) => {
    const trigger = page.locator('.ob[data-story="desktop"] [data-proto-open]');
    await trigger.click();
    await tap(page, "Get started", 2);
    await proto(page).getByRole("button", { name: "Restart" }).click();
    await page.waitForFunction(() => window.__pulseProto.state().screen === 1);
    await page.keyboard.press("Escape");
    await expect(proto(page)).toBeHidden();
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.protoOpen !== undefined)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  });

  test("Tab stays inside the prototype while it's open", async ({ page }) => {
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.querySelector('[role="dialog"]')!.contains(document.activeElement))).toBe(true);
    }
  });
});

test.describe("pulse onboarding prototype, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("opens from the still grid and changes screens instantly", async ({ page }) => {
    await page.goto("/pulse-mockups.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__pulseProto && window.__pulseStories?.desktop);
    await page.locator('.ob[data-story="desktop"] [data-proto-open]').click();
    await proto(page).getByRole("button", { name: "Get started", exact: true }).click();
    expect(await state(page)).toMatchObject({ open: true, screen: 2, settled: true });
  });
});
