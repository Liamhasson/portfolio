// The print files for Liam's mockup shoot (board spread 13; plan Task 10): each piece laid out in real millimetres over
// the photographs print.py treats at print size, and captured at its print resolution. The posters and the sleeve use
// the site's own layout (poster.tsx, marni-came.css .mc-cover), measured from the trim; the photograph runs into the bleed.
//   python3 tools/marni-came/print.py <build> && node tools/marni-came/print.mjs <build>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const build = resolve(process.argv[2]);
const out = join(root, "docs/marni-came/print");
mkdirSync(out, { recursive: true });
const img = (p) => pathToFileURL(join(build, p)).href;
const pub = (p) => pathToFileURL(join(root, "public/case-studies/marni-came", p)).href;
const B = 3; // bleed, mm

const BASE = `
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500&family=Cormorant+Garamond:wght@600&display=block" rel="stylesheet">
<style>
:root { --black:#0a0908; --bone:#eeeae2; --red:#ec1302; --ash:#8f8a82; --dim:#5d5952;
  --serif:"Cormorant Garamond",serif; --info:"Archivo",sans-serif; }
* { box-sizing:border-box; }
html,body { margin:0; background:transparent; }
.piece { position:relative; overflow:hidden; }
.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
.trim { position:absolute; inset:${B}mm; container-type:inline-size; }
/* the poster (poster.tsx; band-site.css .mc-poster) */
.mark { position:absolute; left:8%; top:5%; width:40%; }
.venue { position:absolute; left:7%; bottom:19%; margin:0; white-space:nowrap; font:600 1cqw/.82 var(--serif); text-transform:uppercase; color:var(--red); }
.info { position:absolute; left:8%; right:8%; bottom:5%; margin:0; display:flex; justify-content:space-between; font:500 4.4cqw/1.45 var(--info); letter-spacing:.14em; text-transform:uppercase; color:var(--bone); }
.info span:last-child { text-align:right; } .info i { font-style:normal; color:var(--ash); display:block; }
/* the sleeve (marni-came.css .mc-cover) */
.by { position:absolute; left:0; right:0; top:6.5%; text-align:center; font:500 2.4cqw/1 var(--info); letter-spacing:.34em; text-transform:uppercase; color:var(--bone); }
.t { position:absolute; left:0; right:0; bottom:9%; margin:0; text-align:center; white-space:nowrap; font:600 7.4cqw/1 var(--serif); letter-spacing:.04em; text-transform:uppercase; color:var(--bone); }
.cr { position:absolute; left:0; right:0; bottom:5%; text-align:center; font:500 1.6cqw/1 var(--info); letter-spacing:.24em; text-transform:uppercase; color:var(--ash); }
/* tables (board spread 06: hairlines, Label) */
.sm { font:500 var(--fs)/1.75 var(--info); letter-spacing:.18em; text-transform:uppercase; margin:0; }
.sm i { font-style:normal; color:var(--ash); }
.row { display:flex; justify-content:space-between; gap:3mm; padding:var(--pad) 0; border-bottom:.25mm solid rgba(238,234,226,.16); }
</style>`;

// the series' four layouts, as poster.tsx sets them (Liam, 2026-10-20)
const POSTERS = [
  ["lido", "Lido", "12.2023", "classic"],
  ["badehaus-2024", "Badehaus", "09.02.2024", "side"],
  ["badehaus-2023", "Badehaus", "02.2023", "framed"],
  ["end-of-term", "End of term", "03.2022", "stacked"],
];
const fit = (width, chars) => Math.min(36, width / (chars * 0.68)); // poster.tsx
const MARK = pub("logo/wordmark-distressed-bone.svg");
const INFO = (date) => `<p class="info"><span>Marni Came<i>Live</i></span><span>${date}<i>Berlin</i></span></p>`;
function posterHtml(slug, venue, date, layout) {
  const photo = `<img class="bg" src="${img(`poster-${slug}.jpg`)}">`;
  if (layout === "side") {
    const size = fit(0.8 * 141, venue.length);
    return `${photo}<div class="trim"><img class="mark" style="left:auto;right:7%;width:36%" src="${MARK}">
      <p class="venue" style="left:5%;bottom:5%;font-size:${size.toFixed(2)}cqw;transform:rotate(-90deg);transform-origin:left bottom;translate:${(size * 0.79).toFixed(2)}cqw 0">${venue}</p>
      <p class="info" style="left:auto;right:7%;flex-direction:column;gap:3cqw;text-align:right"><span>Marni Came<i>Live</i></span><span>${date}<i>Berlin</i></span></p></div>`;
  }
  if (layout === "framed") {
    return `<div class="bg" style="background:var(--black)"></div><div class="trim">
      <img src="${img(`poster-${slug}.jpg`)}" style="position:absolute;left:5%;top:4%;width:90%;height:76%;object-fit:cover">
      <img class="mark" style="left:9%;top:7%;width:30%" src="${MARK}">
      <p class="venue" style="left:5%;bottom:6%;font-size:${fit(64, venue.length).toFixed(2)}cqw">${venue}</p>
      <p class="info" style="left:auto;right:5%;bottom:6%;flex-direction:column;gap:1cqw;text-align:right;font-size:3.8cqw"><span>Live<i>Berlin</i></span><span>${date}</span></p></div>`;
  }
  if (layout === "stacked") {
    const words = venue.split(" "); const last = words.pop(); const lead = words.join(" ");
    return `${photo}<div class="trim"><img class="mark" style="width:32%" src="${MARK}">
      <p class="venue" style="bottom:15%;display:flex;flex-direction:column;gap:1.4cqw;line-height:.78">
        <span style="font-size:${fit(30, lead.length).toFixed(2)}cqw">${lead}</span><span style="font-size:${fit(86, last.length).toFixed(2)}cqw">${last}</span></p>${INFO(date)}</div>`;
  }
  return `${photo}<div class="trim"><img class="mark" src="${MARK}">
    <p class="venue" style="font-size:${fit(86, venue.length).toFixed(2)}cqw">${venue}</p>${INFO(date)}</div>`;
}

const pieces = [
  ...POSTERS.map(([slug, venue, date, layout]) => ({
    name: `poster-${slug}-A3`, w: 297 + 2 * B, h: 420 + 2 * B, dpi: 300, jpg: true, html: posterHtml(slug, venue, date, layout),
  })),
  {
    name: "sleeve-12in", w: 304.8 + 2 * B, h: 304.8 + 2 * B, dpi: 300, jpg: true,
    html: `<img class="bg" src="${img("sleeve.jpg")}"><div class="trim">
      <span class="by">Marni Came</span><p class="t">After Heartbreaks</p><span class="cr">Mixed by Fabio Buemi · Mastered by Nadim Khoury</span></div>`,
  },
  {
    // the Badehaus ticket (board spread 06): bone card, black type, hairlines, the tear line above the price
    name: "ticket", w: 70 + 2 * B, h: 140 + 2 * B, dpi: 300,
    html: `<div class="bg" style="background:var(--bone)"></div><div class="trim" style="--fs:2.9mm;--pad:2.4mm;padding:9mm 7mm;display:flex;flex-direction:column;color:var(--black)">
      <style>.row{border-color:rgba(10,9,8,.16)} .sm i{color:var(--dim)}</style>
      <div class="row"><span class="sm">Marni Came</span><span class="sm"><i>Live</i></span></div>
      <div class="row"><span class="sm">Badehaus</span><span class="sm">Berlin</span></div>
      <div class="row"><span class="sm">09.02.2024</span><span class="sm">18:30</span></div>
      <div class="row" style="flex-direction:column;gap:1mm"><span class="sm"><i>With</i></span><span class="sm">Yasha 96 &amp; The Dead Actors</span></div>
      <div style="margin:auto -7mm 3mm;border-top:.5mm dashed rgba(10,9,8,.3)"></div>
      <div class="row" style="border:0;flex-direction:column;gap:1mm"><span class="sm">Early bird</span><span class="sm">9 € · 11 € + drink</span></div></div>`,
  },
  {
    // behind the drum kit: the distressed wordmark on black cloth (edge to edge; hem allowance is the printer's)
    name: "stage-flag", w: 1200, h: 800, dpi: 150, jpg: true,
    html: `<div class="bg" style="background:var(--black)"></div>
      <img src="${pub("logo/wordmark-distressed-bone.svg")}" style="position:absolute;left:15%;width:70%;top:50%;transform:translateY(-50%)">`,
  },
  {
    // a black tee, front: the distressed wordmark small on the left chest, 4 in wide (Liam, 2026-10-21; 12 x 16 in print
    // area, transparent, placed as worn: the wearer's left is the print's right)
    name: "shirt-front", w: 304.8, h: 406.4, dpi: 300, transparent: true,
    html: `<img src="${pub("logo/wordmark-distressed-bone.svg")}" style="position:absolute;right:38mm;width:101.6mm;top:30mm">`,
  },
  {
    // the back: the single's cut faces, large, in one-colour bone ink, and under them the chorus the crowd sings back
    // (Liam, 2026-10-20 and 10-21)
    name: "shirt-back", w: 304.8, h: 406.4, dpi: 300, transparent: true,
    html: `<img src="${img("shirt-faces.png")}" style="position:absolute;left:12.7mm;top:6mm;width:279.4mm">
      <div style="position:absolute;left:0;right:0;top:292mm;text-align:center;font:600 30mm/.92 var(--serif);text-transform:uppercase;color:var(--bone);letter-spacing:.01em">I need it<br>I want it<br>I’m after</div>`,
  },
  {
    // the press kit open on the four members (A4 spread): the burned logo, the singles and the stages; then the band
    name: "epk-spread", w: 420 + 2 * B, h: 297 + 2 * B, dpi: 300, jpg: true,
    html: `<div class="bg" style="background:var(--black)"></div>
      <style>.pg{position:absolute;top:${B}mm;width:210mm;height:297mm;padding:14mm;color:var(--bone)} .k{font:500 2.6mm/1 var(--info);letter-spacing:.16em;text-transform:uppercase;color:var(--ash);margin:0 0 3mm}
        .h{font:600 16mm/.9 var(--serif);text-transform:uppercase;color:var(--red);margin:0 0 9mm} .folio{position:absolute;left:14mm;right:14mm;bottom:10mm;display:flex;justify-content:space-between}
        .m img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block} .m b{display:block;font:600 8mm/1 var(--serif);text-transform:uppercase;margin:3.5mm 0 1.5mm} .m span{font:500 2.6mm/1 var(--info);letter-spacing:.16em;text-transform:uppercase;color:var(--ash)}</style>
      <div class="pg" style="left:${B}mm;--fs:3mm;--pad:2.6mm">
        <img src="${img("burned.jpg")}" style="width:182mm;display:block;margin-bottom:12mm">
        <p class="k">The singles</p>
        <div class="row"><span class="sm"><i>01</i> After Heartbreaks</span><span class="sm"><i>Single</i></span></div>
        <div class="row"><span class="sm"><i>02</i> Dopamine</span><span class="sm"><i>Single</i></span></div>
        <div class="row" style="margin-bottom:10mm"><span class="sm"><i>03</i> You’ll Be You</span><span class="sm"><i>Single</i></span></div>
        <p class="k">Live</p>
        <div class="row"><span class="sm">Badehaus</span><span class="sm"><i>Berlin</i></span></div>
        <div class="row"><span class="sm">Lido</span><span class="sm"><i>Berlin</i></span></div>
        <div class="row"><span class="sm">End of term</span><span class="sm"><i>Berlin</i></span></div>
        <div class="folio"><span class="k">Marni Came</span><span class="k">Press kit</span></div>
      </div>
      <div class="pg" style="left:${210 + B}mm">
        <p class="h">The band</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm 10mm;width:162mm">
          ${[["liam", "Liam", "Vocals · guitar"], ["sami", "Sami", "Drums"], ["pedro", "Pedro", "Bass"], ["rikki", "Rikki", "Guitar"]]
            .map(([f, n, p]) => `<div class="m"><img src="${img(`band-${f}.jpg`)}"><b>${n}</b><span>${p}</span></div>`).join("")}
        </div>
        <div class="folio"><span class="k">Marni Came</span><span class="k">The band</span></div>
      </div>`,
  },
];

const browser = await chromium.launch();
for (const p of pieces) {
  const k = p.dpi / 96; // CSS px per mm is 96/25.4; capturing at dpi/96 gives the print's pixels
  const vw = Math.round((p.w * 96) / 25.4), vh = Math.round((p.h * 96) / 25.4);
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: k });
  // (from a file: a page set from a string can't load the local photographs)
  const html = join(build, `${p.name}.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8">${BASE}</head><body>
    <div class="piece" style="width:${p.w}mm;height:${p.h}mm">${p.html}</div></body></html>`);
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  const png = join(build, `${p.name}.png`);
  await page.locator(".piece").screenshot({ path: png, omitBackground: !!p.transparent });
  await page.close();
  // exact pixel size, the dpi in the file, JPEG for the photographs (a print shop's usual), PNG where it's flat or clear
  const W = Math.round((p.w / 25.4) * p.dpi), H = Math.round((p.h / 25.4) * p.dpi);
  const dst = join(out, `${p.name}.${p.jpg ? "jpg" : "png"}`);
  execFileSync("python3", ["-c", `
from PIL import Image; im = Image.open(${JSON.stringify(png)}); im = im.resize((${W}, ${H}), Image.LANCZOS)
im = im.convert("RGB") if ${p.jpg ? "True" : "False"} else im
im.save(${JSON.stringify(dst)}, dpi=(${p.dpi}, ${p.dpi}), **({"quality": 93, "subsampling": 0} if ${p.jpg ? "True" : "False"} else {"optimize": True}))
print(${JSON.stringify(p.name)}, im.size)`], { stdio: "inherit" });
}
await browser.close();
