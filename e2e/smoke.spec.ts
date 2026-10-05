import { expect, test } from "@playwright/test";

for (const path of ["/", "/pulse", "/cyvore", "/eventread"]) {
  test(`${path} renders with primary nav and h1`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const slug of ["pulse", "cyvore", "eventread"]) {
  test(`legacy /${slug}-case-study redirects to /${slug}`, async ({ page, request }) => {
    const res = await request.get(`/${slug}-case-study`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(`/${slug}`);
    await page.goto(`/${slug}-case-study`);
    await expect(page).toHaveURL(new RegExp(`/${slug}$`));
  });
}

test("skip link moves focus to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});
