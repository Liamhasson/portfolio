import { expect, test, type Page } from "@playwright/test";

// The desk invites you on (desk-invite.ts; Liam, 2026-10-18): stopped on the desk, the lid lifts and the camera leans
// after 1.5 s, "Keep scrolling" shows after 3 s, and a scroll lets both go with no jump in the camera.
// Headless, on the GPU (the story's scene needs WebGL).
test.use({ viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } });
test.setTimeout(240_000);

interface Invite { window: [number, number]; tease: number; cue: boolean; lid: number; lean: number; camera: number[] }
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

  // record every frame while the visitor scrolls on
  await page.evaluate(() => {
    const w = window as unknown as { __deskInvite: Invite; __frames: { tease: number; lid: number; lean: number; camera: number[] }[] };
    w.__frames = [];
    const rec = () => {
      const d = w.__deskInvite;
      w.__frames.push({ tease: d.tease, lid: d.lid, lean: d.lean, camera: [...d.camera] });
      if (w.__frames.length < 150) requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 60);
  await expect(cue).toHaveCSS("opacity", "0", { timeout: 2000 });
  await page.waitForFunction(() => (window as unknown as { __frames: unknown[] }).__frames.length >= 150, null, { timeout: 15_000 });
  const frames = await page.evaluate(() => (window as unknown as { __frames: { tease: number; lid: number; lean: number; camera: number[] }[] }).__frames);
  // both go back to 0 (the clock then starts again: still on the desk, the tease may return 1.5 s later)
  const zero = frames.findIndex((f) => f.tease === 0);
  expect(zero).toBeGreaterThan(5);                                  // eased back, not cut
  expect(frames[zero].lid).toBe(0);
  expect(frames[zero].lean).toBe(0);
  // (the frames before the wheel reaches the page: the tease still settling at its peak)
  const crest = frames.slice(0, zero).reduce((m, f, i) => (f.tease > frames[m].tease ? i : m), 0);
  for (let i = crest + 1; i <= zero; i++) expect(frames[i].tease).toBeLessThanOrEqual(frames[i - 1].tease + 1e-6);
  // no pop: the tease eases back over many frames, and the camera never steps by anything like the lean in one frame
  let maxTease = 0, maxStep = 0;
  for (let i = 1; i < frames.length; i++) {
    maxTease = Math.max(maxTease, Math.abs(frames[i].tease - frames[i - 1].tease));
    const [a, b] = [frames[i].camera, frames[i - 1].camera];
    maxStep = Math.max(maxStep, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  expect(maxTease).toBeLessThan(0.2);
  expect(maxStep).toBeLessThan(before.lean * 0.5);
});
