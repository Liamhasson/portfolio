// Captures Eventread's month calendar for the case-study hero.
// Usage: node scripts/capture/eventread-calendar.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "public/case-studies/eventread";
const params = new URLSearchParams({
  city: "Berlin",
  country: "Germany",
  countryCode: "DE",
  placeId: "hero-berlin",
  lat: "52.52",
  lon: "13.405",
  date: "2026-11-01", // the app wants a full date; "2026-11" crashes its results page
  range: "month",
  genre: "Rock",
  capacity: "1000",
});

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });
await page.goto(`https://eventread.vercel.app/results?${params}`, { waitUntil: "networkidle" });
// Loaded = both source pills have left "Checking …" (see LiveDataStatus in the app).
await page.getByText("live data").first().waitFor({ timeout: 30000 });
await page.waitForFunction(() => !document.body.innerText.includes("Checking"), null, { timeout: 30000 });
const body = await page.locator("body").innerText();
if (/couldn't be reached|sample data|Something broke/.test(body)) {
  throw new Error("Eventread did not load cleanly; not saving a broken capture.");
}
if (!body.includes("Powered by JamBase")) throw new Error("JamBase source missing; not saving.");
await page.waitForTimeout(1500); // let the calendar cells settle
await page.screenshot({ path: `${OUT}/calendar-berlin-2026-11.png` });
await browser.close();
console.log(`saved ${OUT}/calendar-berlin-2026-11.png`);
