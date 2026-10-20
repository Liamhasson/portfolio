import { expect, test } from "@playwright/test";
import { STUDIES, expectNoHorizontalScroll, expectNoSeriousA11y, expectTextFloors, firstViewBudget, unitPx } from "./cs-helpers";

const WORLD_BG: Record<(typeof STUDIES)[number], string> = {
  eventread: "rgb(248, 248, 246)", // --canvas #f8f8f6
  cyvore: "rgb(11, 8, 20)",        // --void #0b0814
  pulse: "rgb(6, 11, 20)",         // --void #060b14
  "nordic-logic": "rgb(249, 249, 248)", // --canvas #f9f9f8 (Nordic Logic's Daylight)
  "marni-came": "rgb(10, 9, 8)",   // Blackout #0a0908
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

for (const slug of STUDIES) {
  test(`/${slug} shared blocks follow the board`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const challenges = page.getByRole("region", { name: "Challenges" });
    await expect(challenges.getByText("What happened").first()).toBeVisible();
    await expect(challenges.getByText("What I did").first()).toBeVisible();
    await expect(challenges.getByText("What it changed").first()).toBeVisible();
    const next = page.getByRole("navigation", { name: "Next case study" });
    await expect(next.locator("img")).toHaveCount(1); // the next study peeks in
    await expectNoSeriousA11y(page);
    await expectTextFloors(page);
  });
  for (const width of [1180, 390]) {
    test(`/${slug} at ${width}px: no sideways scroll, floors hold, accessible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${slug}`);
      await expectNoHorizontalScroll(page);
      await expectTextFloors(page);
      await expectNoSeriousA11y(page);
    });
  }
  test(`/${slug} first view stays in budget`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const b = await firstViewBudget(page);
    expect(b.lcpBytes).toBeLessThanOrEqual(200 * 1024);
    expect(b.imageBytes).toBeLessThanOrEqual(1024 * 1024);
    expect(b.earlyVideos).toEqual([]);
  });
  test(`/${slug}: every focusable in the article shows a visible focus ring`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const missing: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !a.closest("article[data-world]")) return null;
        const cs = getComputedStyle(a);
        const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
        return ring || cs.boxShadow !== "none" ? "" : a.outerHTML.slice(0, 80);
      });
      if (r) missing.push(r);
    }
    expect(missing).toEqual([]);
  });
}

test("Cyvore's quote carries its impact, in quotation marks", async ({ page }) => {
  await page.goto("/cyvore");
  const impact = page.getByRole("region", { name: "Impact" });
  await expect(impact.locator("blockquote")).toContainText("“We weren't looking for a designer.");
  await expect(impact.locator("blockquote")).toContainText("funding round.”");
  await expect(impact.getByText("Yoav Rotem", { exact: true })).toBeVisible();
  await expect(impact.getByText("CTO, Cyvore", { exact: true })).toBeVisible();
});
