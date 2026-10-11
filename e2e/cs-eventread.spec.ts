import { expect, test } from "@playwright/test";
import { collectConsoleErrors, expectNoHorizontalScroll, expectNoSeriousA11y } from "./cs-helpers";

test("Eventread's middle is the board: problem stat, the Danger Score band, the walkthrough", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/eventread");
  const problem = page.getByRole("region", { name: "Problem" });
  await expect(problem).toContainText("Two bands, one lost night.");
  await expect(problem.getByText("150", { exact: true })).toBeVisible();
  await expect(problem).toContainText("shows every night");
  const solution = page.getByRole("region", { name: "Solution" });
  await expect(solution).toContainText("The Danger Score.");
  for (const name of ["Muse - The Wow! Signal Europa Tour", "Horse Lords", "TAEMIN"]) await expect(solution.getByText(name).first()).toBeVisible();
  for (const r of ["= 1.00", "= 0.60", "= 0.16"]) await expect(solution.getByText(r).first()).toBeVisible();
  await expect(solution).toContainText("relevance is.");
  const how = page.getByRole("region", { name: "How it works" });
  for (const h of ["Search, then save it as an act", "Follow the date you booked", "Plan a tour as one run"]) await expect(how.getByRole("heading", { level: 3, name: h })).toBeVisible();
  await expect(how.getByText("Under the hood", { exact: true })).toBeVisible();
  await expect(how.locator("video")).toHaveCount(2);
  await expect(how.locator("img")).toHaveCount(2);
  expect(errors).toEqual([]);
  await expectNoSeriousA11y(page);
});

test("Eventread's videos are only fetched near the screen", async ({ page }) => {
  const mp4: string[] = [];
  page.on("request", (r) => { if (r.url().endsWith(".mp4")) mp4.push(r.url()); });
  await page.goto("/eventread");
  await page.waitForLoadState("networkidle");
  expect(mp4).toEqual([]); // the walkthrough is far below the fold
  await page.getByRole("region", { name: "How it works" }).scrollIntoViewIfNeeded();
  await expect.poll(() => mp4.length).toBeGreaterThan(0);
});

test("Eventread at 390: the band runs edge to edge with the phone calculator, nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/eventread");
  await expectNoHorizontalScroll(page);
  const band = page.getByRole("region", { name: "Solution" });
  const box = (await band.boundingBox())!;
  expect(box.x).toBeLessThanOrEqual(0.5);
  expect(box.width).toBeGreaterThanOrEqual(389);
  await expect(band.getByText("Cap", { exact: true }).first()).toBeVisible(); // the phone variant's short labels
  await expectNoSeriousA11y(page);
});

test("the walkthrough's recordings fill their crops as on the board (the site's base styles don't cap them)", async ({ page }) => {
  await page.goto("/eventread");
  const crops = await page.evaluate(() => [...document.querySelectorAll(".crop")].map((c) => {
    const v = c.querySelector("video")!;
    return { video: v.getBoundingClientRect().width, want: c.getBoundingClientRect().width * 1728 / Number(getComputedStyle(c).getPropertyValue("--w")) };
  }));
  expect(crops).toHaveLength(2);
  for (const c of crops) expect(Math.abs(c.video - c.want)).toBeLessThan(2);
});

test("followed dates and the tour line up: both screenshots start on the same line", async ({ page }) => {
  await page.goto("/eventread");
  const tops = await page.evaluate(() => [...document.querySelectorAll(".w-col .w-tray")].map((t) => t.getBoundingClientRect().top));
  expect(tops).toHaveLength(2);
  expect(Math.abs(tops[0] - tops[1])).toBeLessThan(1);
});

test("on a phone the hero shows the board's crop of the day tiles, not the whole month shrunk", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/eventread");
  const w = await page.evaluate(() => {
    const tray = document.querySelector("header .tray")!.getBoundingClientRect(), img = document.querySelector("header .tray img")!.getBoundingClientRect();
    return img.width / tray.width;
  });
  expect(w).toBeGreaterThan(1.5); // 720 units of image in a 358-unit tray, as the board's phone frame
});
