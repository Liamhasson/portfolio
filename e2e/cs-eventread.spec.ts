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
