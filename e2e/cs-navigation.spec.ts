import { expect, test } from "@playwright/test";

/** Part C plan, Review Focus 1: leaving a case study by a link leaves nothing of it running; Back brings it back. */
test("leaving Cyvore by the next-project link leaves nothing of it running; Back brings it back working", async ({ page }) => {
  await page.goto("/cyvore");
  await page.waitForFunction(() => window.__csScrollTriggers && window.__csScrollTriggers().includes("cyvore"));
  await page.getByRole("link", { name: "Next project: Pulse" }).click();
  await expect(page).toHaveURL(/\/pulse$/);
  await expect.poll(() => page.evaluate(() => window.__csScrollTriggers!().filter((w) => w === "cyvore").length)).toBe(0);
  expect(await page.locator("[data-world='cyvore']").count()).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/cyvore$/);
  await page.waitForFunction(() => window.__csScrollTriggers!().includes("cyvore"));
});

test("leaving Pulse by the next-project link leaves nothing of it running, and the page can scroll", async ({ page }) => {
  await page.goto("/pulse");
  await page.waitForFunction(() => window.__csScrollTriggers && window.__csScrollTriggers().includes("pulse"));
  await page.getByRole("link", { name: "Next project: Nordic Logic" }).click(); // Pulse → Nordic Logic since 2026-10-13
  await expect(page).toHaveURL(/\/nordic-logic$/);
  await expect.poll(() => page.evaluate(() => window.__csScrollTriggers!().filter((w) => w === "pulse").length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  await page.goBack();
  await expect(page).toHaveURL(/\/pulse$/);
  await page.waitForFunction(() => window.__csScrollTriggers!().includes("pulse"));
});
