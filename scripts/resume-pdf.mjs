// Prints docs/resume/resume.html to public/Liam-Hasson-Resume.pdf (US Letter, one page, links kept).
//   node scripts/resume-pdf.mjs [out.pdf]
import { chromium } from "playwright";
import path from "node:path";
const src = path.resolve("docs/resume/resume.html");
const out = process.argv[2] ?? "public/Liam-Hasson-Resume.pdf";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + src, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const pages = await page.evaluate(() => Math.ceil(document.body.scrollHeight / (792 * 4 / 3)));
if (pages > 1) throw new Error(`the resume runs to ${pages} pages`);
await page.pdf({ path: out, format: "Letter", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log("printed", out);
