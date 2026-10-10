// Records Eventread in use for its index thumbnail: the month calendar for Berlin (Nov 2026, Rock) loading its live
// sources, then a night opening in the detail panel. The real app, nothing staged.
// Usage: node scripts/capture/eventread-clip.mjs  -> test-results/work/eventread-raw.webm
import { chromium } from "playwright";
import fs from "node:fs";

const dir = "test-results/work/video-eventread";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const params = new URLSearchParams({
  city: "Berlin", country: "Germany", countryCode: "DE", placeId: "hero-berlin", lat: "52.52", lon: "13.405",
  date: "2026-11-01", range: "month", genre: "Rock", capacity: "1000",
});
const size = { width: 1440, height: 900 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
const page = await ctx.newPage();
await page.goto(`https://eventread.vercel.app/results?${params}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !document.body.innerText.includes("Checking"), null, { timeout: 40000 });
const body = await page.locator("body").innerText();
if (/couldn't be reached|sample data|Something broke/.test(body)) throw new Error("Eventread did not load cleanly");
await page.waitForTimeout(1500);
// open a few nights in turn, as a booker scanning the month would
// (each day is a button whose text starts with its two-digit date)
for (const day of ["14", "18", "11"]) {
  const cell = page.locator("button").filter({ hasText: new RegExp(`^${day}`) }).filter({ hasNotText: /·/ }).first();
  await cell.hover();
  await page.waitForTimeout(400);
  await cell.click();
  await page.waitForTimeout(2000);
}
await ctx.close();
await browser.close();
fs.renameSync(`${dir}/${fs.readdirSync(dir).find((n) => n.endsWith(".webm"))}`, "test-results/work/eventread-raw.webm");
console.log("ok test-results/work/eventread-raw.webm");
