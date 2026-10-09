// The project index as the laptop screen shows it: the still (its final state, 3200x2000, the screen's texture in Blender
// and on the site) and the layout of its first reveal (each animated element's box, delay and share of the screen's
// light), so the site can play the reveal on the screen exactly as the CSS does (src/three/sand/screen-reveal.ts).
//   node blender/lookdev/capture_index.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
mkdirSync(join(here, "textures-local"), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(join(root, "docs/prototypes/work-index.html")).href + "#still");
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: ".replay{display:none!important} .wake{display:none!important}" });
const still = join(here, "textures-local", "work-index-screen.png");
await page.screenshot({ path: still, clip: { x: 0, y: 0, width: 1600, height: 1000 } });

// the reveal: every element the CSS animates, in the screen's 0..1 frame (y down), with its delay; and each one's share
// of the light the finished screen gives off (linear), so the glow on the desk can follow the reveal
const layout = await page.evaluate(async (src) => {
  const s = document.getElementById("screen").getBoundingClientRect();
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [(r.left - s.left) / s.width, (r.top - s.top) / s.height, (r.right - s.left) / s.width, (r.bottom - s.top) / s.height];
  };
  const delays = { title: 0.2, count: 0.3 };
  const els = [
    { name: "title", el: document.querySelector(".title"), delay: delays.title },
    { name: "count", el: document.querySelector(".count"), delay: delays.count },
    ...[...document.querySelectorAll(".row")].map((el, i) => ({ name: `row${i + 1}`, el, delay: 0.55 + 0.13 * i })),
  ];
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (i) => 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
  const bg = lum(((c.height - 2) * c.width + 2) * 4);   // the background (a corner)
  let total = 0;
  for (let i = 0; i < px.length; i += 4) total += lum(i);
  const out = els.map(({ name, el, delay }) => {
    const b = box(el);
    let sum = 0;
    for (let y = Math.floor(b[1] * c.height); y < Math.ceil(b[3] * c.height); y++)
      for (let x = Math.floor(b[0] * c.width); x < Math.ceil(b[2] * c.width); x++) sum += lum((y * c.width + x) * 4) - bg;
    return { name, box: b.map((v) => +v.toFixed(5)), delay, light: +(sum / total).toFixed(5) };
  });
  return { elements: out, background_light: +((bg * c.width * c.height) / total).toFixed(5), bg_linear: bg };
}, "data:image/png;base64," + (await import("node:fs")).readFileSync(still).toString("base64"));

const reveal = {
  // CSS: .play .title/.count/.row { animation: surface .9s cubic-bezier(.22,1,.36,1) both } from { opacity:0;
  // transform: translateY(1.2cqw); filter: blur(6px) }; .wake { animation: wake .6s ease-out } to { opacity: 0 }
  surface: { duration: 0.9, ease: [0.22, 1, 0.36, 1], rise: 0.012 * 1.6, blur_px: 6, width_px: 1600 },
  wake: { duration: 0.6, ease: [0, 0, 0.58, 1] },
  ...layout,
};
writeFileSync(join(root, "src/three/sand/screen-reveal.json"), JSON.stringify(reveal, null, 2) + "\n");
await browser.close();
console.log("wrote", still, "and src/three/sand/screen-reveal.json");
console.log(JSON.stringify(reveal.elements.map((e) => [e.name, e.light])), "bg", reveal.background_light);
