import { expect, test, type Page } from "@playwright/test";

/** The site nav, as on the boards (Liam, 2026-10-11): light under the pointer, colours matched to what's behind it. */
const tone = (page: Page) => page.evaluate(() => document.documentElement.dataset.navTone);
const navVar = (page: Page, v: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), v);

test("over Eventread's paper the nav is light, over its navy band it turns dark", async ({ page }) => {
  await page.goto("/eventread");
  await expect.poll(() => tone(page)).toBe("light");
  expect(await navVar(page, "--nav-ink")).toBe("#1a1a2e");
  await page.evaluate(() => {
    const band = document.querySelector("article .f.navy")!.getBoundingClientRect();
    window.scrollTo(0, scrollY + band.top + 200); // the navy band under the nav
  });
  await expect.poll(() => tone(page)).toBe("dark");
});

test("Pulse's deep navy makes it dark, in Pulse's own colours; the home is dark in the site's", async ({ page }) => {
  await page.goto("/pulse");
  await expect.poll(() => tone(page)).toBe("dark");
  expect(await navVar(page, "--nav-canvas")).toBe("#eef3fa");
  await page.goto("/");
  await expect.poll(() => tone(page)).toBe("dark");
  expect(await navVar(page, "--nav-canvas")).toBe("#f7fafc");
});

test("the light follows the pointer inside a pill", async ({ page }) => {
  await page.goto("/cyvore");
  const pill = page.getByRole("link", { name: "Projects", exact: true });
  const box = (await pill.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.move(box.x + 14, box.y + box.height / 2);
  await expect.poll(() => pill.evaluate((el) => el.style.getPropertyValue("--x"))).toBe("14px");
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 4 });
  await expect.poll(() => pill.evaluate((el) => parseFloat(el.style.getPropertyValue("--x")))).toBeGreaterThan(box.width - 14);
});

test("About and Contact go nowhere yet", async ({ page }) => {
  await page.goto("/pulse");
  const url = page.url();
  // marked aria-disabled, so Playwright won't click it unforced; a visitor still can, and nothing happens
  await page.getByRole("button", { name: "About, coming soon" }).click({ force: true });
  await page.getByRole("button", { name: "Contact, coming soon" }).click({ force: true });
  await page.waitForTimeout(300);
  expect(page.url()).toBe(url);
});

test("on a case study Projects is the filled pill, and Back goes to the projects index", async ({ page }) => {
  await page.goto("/eventread");
  const projects = (await page.getByRole("link", { name: "Projects", exact: true }).boundingBox())!;
  await expect.poll(() => page.evaluate(() => document.querySelector(".sh-nav .hl")!.classList.contains("on"))).toBe(true);
  const left = await page.evaluate(() => document.querySelector(".sh-nav .hl i")!.getBoundingClientRect().left);
  expect(Math.abs(left - projects.x)).toBeLessThan(1.5);
  await expect(page.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/#projects");
});

test("keyboard focus shows the outline", async ({ page }) => {
  await page.goto("/cyvore");
  await page.getByRole("link", { name: "Projects", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return `${s.outlineStyle} ${s.outlineWidth}`; });
  expect(outline).toBe("solid 2px");
});

test("the Back button stays put while the page scrolls", async ({ page }) => {
  await page.goto("/eventread");
  const top = () => page.evaluate(() => Math.round(document.querySelector(".sh-back")!.getBoundingClientRect().top));
  await page.waitForTimeout(900); // the entrance (rise 8px, 600ms) has settled
  const before = await top();
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(200);
  expect(await top()).toBe(before);
});
