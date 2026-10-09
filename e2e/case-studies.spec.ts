import { expect, test } from "@playwright/test";

const loop = [
  ["eventread", "Cyvore"],
  ["cyvore", "Pulse"],
  ["pulse", "Eventread"],
] as const;

for (const [slug, next] of loop) {
  test(`/${slug} has the full frame`, async ({ page }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("definition").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "What got in the way" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Outcome" })).toBeVisible();
    await page.getByRole("link", { name: `Next project: ${next}` }).click();
    await expect(page).toHaveURL(new RegExp(`/${next.toLowerCase()}$`));
  });
}
