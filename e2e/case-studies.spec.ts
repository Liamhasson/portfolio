import { expect, test } from "@playwright/test";

const loop = [
  ["eventread", "Cyvore", "The Danger Score."],
  ["cyvore", "Pulse", "One screen, everything."],
  ["pulse", "Eventread", "Goal-based onboarding."],
] as const;

for (const [slug, next, signature] of loop) {
  test(`/${slug} has the full frame`, async ({ page }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("definition").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Solution" })).toContainText(signature);
    await expect(page.getByRole("region", { name: "Challenges" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Impact" })).toBeVisible();
    await page.getByRole("link", { name: `Next project: ${next}` }).click();
    await expect(page).toHaveURL(new RegExp(`/${next.toLowerCase()}$`));
  });
}
