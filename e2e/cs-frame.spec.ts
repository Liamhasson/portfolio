import { expect, test } from "@playwright/test";
import { STUDIES, expectNoHorizontalScroll, unitPx } from "./cs-helpers";

const WORLD_BG: Record<(typeof STUDIES)[number], string> = {
  eventread: "rgb(248, 248, 246)", // --canvas #f8f8f6
  cyvore: "rgb(11, 8, 20)",        // --void #0b0814
  pulse: "rgb(6, 11, 20)",         // --void #060b14
};

for (const slug of STUDIES) {
  test(`/${slug} sits in its world, in the board's units`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const article = page.locator(`article[data-world="${slug}"]`);
    await expect(article).toHaveClass(/\bcs\b/);
    expect(await article.locator(".f").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(WORLD_BG[slug]);
    expect(await unitPx(article.locator(".f").first())).toBeCloseTo(1, 1); // 1440 wide: one board unit ≈ 1px
    await expectNoHorizontalScroll(page);
  });
}

test("the worlds don't leak onto the site", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.querySelectorAll("[data-world]").length)).toBe(0);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.goto("/eventread");
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bg);
});

test("below 1100px the sections switch to the phone unit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pulse");
  expect(await unitPx(page.locator("article .f").first())).toBeCloseTo(1, 1); // 390 wide: one phone-board unit ≈ 1px
});
