import { expect, test, type Page } from "@playwright/test";

// The desk invites you on (desk-invite.ts; Liam, 2026-10-18): stopped on the desk, the lid lifts and the camera leans
// after 1.5 s, "Keep scrolling" shows after 3 s, and a scroll lets both go with no jump in the camera.
// Headless, on the GPU (the story's scene needs WebGL).
test.use({ viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } });
test.setTimeout(240_000);

interface Invite { window: [number, number]; tease: number; cue: boolean; lid: number; lean: number; camera: number[]; toScreen: number }
const invite = (page: Page) => page.evaluate(() => (window as unknown as { __deskInvite: Invite }).__deskInvite);

test("stopped on the desk: the tease after 1.5 s, the text after 3 s; a scroll lets both go with no jump", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const w = window as unknown as { __desk3d?: unknown; __deskInvite?: Invite };
    return !document.documentElement.dataset.loader && !!w.__desk3d && !!w.__deskInvite?.window;
  }, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);

  // onto the desk, the middle of its window
  await page.evaluate(() => {
    const [a, b] = (window as unknown as { __deskInvite: Invite }).__deskInvite.window;
    const end = document.getElementById("projects")!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, (((a + b) / 2) / 5.1) * end);   // (STORY_SCREENS + SCREEN_HOLD screens to the index's anchor)
  });
  const stopped = Date.now();
  const cue = page.locator("[data-keep-cue]");

  await page.waitForTimeout(1200);
  expect((await invite(page)).tease).toBe(0);                       // nothing yet
  await expect(cue).toHaveCSS("opacity", "0");

  await page.waitForFunction(() => {
    const d = (window as unknown as { __deskInvite: Invite }).__deskInvite;
    return d.lid > 0 || d.lean > 0;
  }, null, { timeout: 5000 });
  expect(Date.now() - stopped).toBeGreaterThanOrEqual(1500);
  const peak = await invite(page);
  expect(peak.cue).toBe(false);

  await expect(cue).toHaveText("Keep scrolling", { timeout: 5000 });
  expect(Date.now() - stopped).toBeGreaterThanOrEqual(3000);
  await expect(cue).toHaveCSS("opacity", "1");
  await page.waitForTimeout(600);
  const before = await invite(page);
  expect(before.lid).toBeGreaterThan(0);
  expect(before.lean).toBeGreaterThan(0);

  // a small scroll on (60 px, less than the lean): every frame recorded
  type Frame = { tease: number; lid: number; lean: number; camera: number[]; toScreen: number; y: number };
  const record = (n: number) => page.evaluate((n) => {
    const w = window as unknown as { __deskInvite: Invite; __frames: Frame[] };
    w.__frames = [];
    const rec = () => {
      const d = w.__deskInvite;
      w.__frames.push({ tease: d.tease, lid: d.lid, lean: d.lean, camera: [...d.camera], toScreen: d.toScreen, y: window.scrollY });
      if (w.__frames.length < n) requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  }, n);
  const recorded = async (n: number) => {
    await page.waitForFunction((n) => (window as unknown as { __frames: unknown[] }).__frames.length >= n, n, { timeout: 15_000 });
    return page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
  };
  /** The camera never goes back along the path: its distance to the screen never grows, in any frame. */
  const neverBack = (frames: Frame[]) => {
    for (let i = 1; i < frames.length; i++) expect(frames[i].toScreen, `frame ${i}`).toBeLessThanOrEqual(frames[i - 1].toScreen + 1e-6);
  };
  await page.mouse.move(720, 450);
  await record(70);   // (~1.2 s: under the 1.5 s after which the tease would return)
  await page.mouse.wheel(0, 60);
  await expect(cue).toHaveCSS("opacity", "0", { timeout: 2000 });
  const small = await recorded(70);
  expect(small.at(-1)!.y).toBeGreaterThan(small[0].y);              // it did scroll
  neverBack(small);
  // the lid eases shut (no jump), the lean holds whatever the scroll hasn't used up
  const crest = small.reduce((m, f, i) => (f.tease > small[m].tease ? i : m), 0);
  for (let i = crest + 1; i < small.length; i++) {
    expect(small[i].tease).toBeLessThanOrEqual(small[i - 1].tease + 1e-6);
    expect(small[i - 1].tease - small[i].tease).toBeLessThan(0.2);
  }
  expect(small.at(-1)!.lid).toBeLessThan(0.5);

  // a longer scroll on: the lean is used up, the lid shut, both back to 0, never a step back
  await record(120);
  await page.mouse.wheel(0, 300);
  const long = await recorded(120);
  neverBack(long);
  const after = await invite(page);
  expect(after.lid).toBe(0);
  expect(after.lean).toBe(0);
  expect(after.cue).toBe(false);
  // no pop either way: the camera only ever goes forward (above), and never ahead of the path's own move (the lean, along
  // the way to the screen, only shrinks while scrolling)
  // (from the lean's crest: the frames before the wheel reaches the page can still be settling at its peak)
  for (const fr of [small, long]) {
    const top = fr.reduce((m, f, i) => (f.lean > fr[m].lean ? i : m), 0);
    for (let i = top + 1; i < fr.length; i++) expect(fr[i].lean).toBeLessThanOrEqual(fr[i - 1].lean + 1e-6);
  }
});
