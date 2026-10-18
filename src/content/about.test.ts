// src/content/about.test.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ABOUT, CONTACT, plain } from "./about";

/** An MP4's video track: its coded frame size and its frames per second (the media timescale over the sample duration,
 *  which must be the same for every sample). Reads the boxes moov > trak > mdia > (mdhd, hdlr, minf > stbl > (stsd, stts)). */
function mp4Video(file: string) {
  const b = readFileSync(file);
  const boxes = (from: number, to: number) => {
    const out: { type: string; start: number; end: number }[] = [];
    for (let at = from; at + 8 <= to;) {
      let size = b.readUInt32BE(at), head = 8;
      if (size === 1) { size = Number(b.readBigUInt64BE(at + 8)); head = 16; } else if (size === 0) size = to - at;
      out.push({ type: b.toString("latin1", at + 4, at + 8), start: at + head, end: at + size });
      at += size;
    }
    return out;
  };
  const child = (box: { start: number; end: number }, type: string) => boxes(box.start, box.end).find((x) => x.type === type)!;
  const moov = boxes(0, b.length).find((x) => x.type === "moov")!;
  for (const trak of boxes(moov.start, moov.end).filter((x) => x.type === "trak")) {
    const mdia = child(trak, "mdia");
    if (b.toString("latin1", child(mdia, "hdlr").start + 8, child(mdia, "hdlr").start + 12) !== "vide") continue;
    const mdhd = child(mdia, "mdhd"), v1 = b[mdhd.start] === 1;
    const timescale = b.readUInt32BE(mdhd.start + (v1 ? 20 : 12));
    const stbl = child(child(mdia, "minf"), "stbl"), stts = child(stbl, "stts"), entry = child(stbl, "stsd").start + 8;
    const n = b.readUInt32BE(stts.start + 4);
    const deltas = new Set<number>();
    for (let i = 0; i < n; i++) deltas.add(b.readUInt32BE(stts.start + 8 + i * 8 + 4));
    // (the visual sample entry's width and height: after its 8-byte header, 6 reserved, the data reference, and 16 more)
    return { width: b.readUInt16BE(entry + 32), height: b.readUInt16BE(entry + 34), fps: deltas.size === 1 ? timescale / [...deltas][0] : NaN };
  }
  throw new Error(`${file}: no video track`);
}

const approved = readFileSync(join(process.cwd(), "docs/copy/about.md"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

describe("About and Contact content (spec 2026-10-12-about-contact-design.md)", () => {
  test("Liam's approved text, verbatim, in order: three lines on the track, the last one closing it", () => {
    expect([...ABOUT.lines.map(plain), plain(ABOUT.closing)]).toEqual(approved);
  });
  test("two colours: the highlights are exactly the spec's table", () => {
    const his = (l: { t: string; hi?: boolean }[]) => l.filter((s) => s.hi).map((s) => s.t);
    expect(his(ABOUT.lines[0])).toEqual(["I’m Liam. I love crafting products"]);
    expect(his(ABOUT.lines[1])).toEqual(["eight years managing two rock bands", "making something out of nothing"]);
    expect(his(ABOUT.lines[2])).toEqual(["That’s still how I work.", "problems nobody pointed at"]);
    expect(his(ABOUT.quotes[0].text)).toEqual(["we closed our first funding round."]);
    expect(his(ABOUT.closing)).toEqual(["I’d like to hear about it."]);
  });
  test("Andrada's quote, verbatim from the live portfolio, the problems part in white (Liam, 2026-10-12)", () => {
    const q = ABOUT.quotes[1];
    expect(plain(q.text)).toBe("Exceptional talent, a strong aesthetic sense, and an in-depth ability to make inquiries about the problems he is trying to solve.");
    expect(q.text.filter((s) => s.hi).map((s) => s.t)).toEqual(["an in-depth ability to make inquiries about the problems he is trying to solve."]);
    expect(q).toMatchObject({ name: "Andrada Popan-Dorca", role: "UX Mentor, CareerFoundry" });
  });
  test("the quotes: Yoav's verbatim; room for up to four", () => {
    expect(plain(ABOUT.quotes[0].text)).toBe("We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.");
    expect(ABOUT.quotes[0]).toMatchObject({ name: "Yoav Rotem", role: "CTO, Cyvore" });
    expect(ABOUT.quotes.length).toBeGreaterThanOrEqual(1);
    expect(ABOUT.quotes.length).toBeLessThanOrEqual(4);
  });
  test("What I do: Liam's three verbs, twelve skills, each with its proof; links only to the case studies", () => {
    expect(ABOUT.verbs.map((v) => v.title)).toEqual(["Find the problem.", "Check I’m right.", "Build it."]);
    expect(ABOUT.verbs.map((v) => v.skills.length)).toEqual([3, 3, 6]);
    const skills = ABOUT.verbs.flatMap((v) => v.skills);
    expect(skills.map((s) => s.name)).toEqual([
      "User research", "Market & competitor research", "Information architecture",
      "Usability testing", "Data-informed decisions", "Stakeholder communication",
      "Interaction & motion", "Design systems", "Web design", "Branding", "Prototyping in code", "3D modeling",
    ]);
    for (const s of skills) {
      expect(s.proof.length).toBeGreaterThan(10);
      if (s.href) expect(["/eventread", "/cyvore", "/pulse"]).toContain(s.href);
    }
    expect(skills.find((s) => s.name === "3D modeling")!.href).toBeUndefined();
    expect(ABOUT.opening).not.toHaveProperty("href");   // (plain text: Liam, 2026-10-12)
  });
  test("the resume and the contact details, verbatim", () => {
    // the new resume, hosted on the site (Liam, 2026-10-12)
    expect(ABOUT.resume.href).toBe("/Liam-Hasson-Resume.pdf");
    expect(existsSync(join(process.cwd(), "public/Liam-Hasson-Resume.pdf"))).toBe(true);
    expect(CONTACT).toEqual({ headline: "Got something on your mind?", email: "Liamhasson@gmail.com", linkedin: "https://www.linkedin.com/in/liamhasson/", phone: "+49 160 771 0652" });
  });
  // the pictures along the track (spec 2026-10-16-about-pictures-design.md §2)
  const pictures = () => [...ABOUT.pictures.bands, ABOUT.pictures.studio, ...ABOUT.pictures.strip];
  test("every picture's source is unique (the portrait included)", () => {
    const srcs = [ABOUT.portrait!.src, ...pictures().map((p) => p.src)];
    expect(srcs).toHaveLength(7);
    expect(new Set(srcs).size).toBe(srcs.length);
  });
  test("the strip links to the three case studies, in order", () => {
    expect(ABOUT.pictures.strip.map((p) => p.href)).toEqual(["/cyvore", "/eventread", "/nordic-logic"]);
    expect(ABOUT.pictures.strip.map((p) => p.caption)).toEqual(["Cyvore", "Eventread", "Nordic Logic"]);
  });
  test("the band and strip loops play About's own right-sized copies, not the shared full-size files (Liam, 2026-10-17)", () => {
    // (two 1280-wide /work or /playground files playing at once dropped the page to 30 fps; the posters stay the shared ones)
    for (const p of [...ABOUT.pictures.bands, ...ABOUT.pictures.strip]) expect(p.src).toMatch(/^\/about\/loops\/[a-z-]+\.mp4$/);
    expect(ABOUT.pictures.strip.map((p) => p.poster)).toEqual(["/work/cyvore.jpg", "/work/eventread.jpg", "/work/nordic-logic-live.jpg"]);
  });
  test("those loops run at 120 fps (each frame repeated), at their right size: two or more playing at 30 fps cap the whole page at 30 fps in Chrome", () => {
    // (Chrome's compositor holds the page to the fastest playing video's rate once two or more videos play and nothing is
    // being scrolled or touched; a 120 fps loop keeps that at a ProMotion screen's 120 Hz: task-clips-report.md)
    for (const p of ABOUT.pictures.strip) expect(mp4Video(join(process.cwd(), "public", p.src)), p.id).toEqual({ width: 480, height: 300, fps: 120 });
    for (const p of ABOUT.pictures.bands) expect(mp4Video(join(process.cwd(), "public", p.src)), p.id).toEqual({ width: 320, height: 180, fps: 120 });
  });
  test("Pulse is not in About's pictures", () => {
    for (const p of pictures()) {
      for (const v of [p.src, p.poster, p.caption, p.title, p.alt, p.href]) expect(v ?? "").not.toMatch(/pulse/i);
    }
  });
  test("the bands and the studio are the spec's table, verbatim", () => {
    expect(ABOUT.pictures.bands.map((p) => [p.src, p.poster, p.title])).toEqual([
      ["/about/loops/after-heartbreaks-loop.mp4", "/playground/after-heartbreaks-film.jpg", "Marni Came"],
      ["/about/loops/my-small-world-loop.mp4", "/playground/my-small-world.jpg", "Sanskrit"],
    ]);
    expect(ABOUT.pictures.studio).toMatchObject({ src: "/playground/studio-overhead.jpg", caption: "Producing · Marni Came", loop: false });
  });
  test("the desk film left About (Liam, 2026-10-18: \"Remove the desk.\"); its files stay in the repo for a one-line restore", () => {
    expect(Object.keys(ABOUT.pictures).sort()).toEqual(["bands", "strip", "studio"]);
    for (const p of pictures()) expect(p.src).not.toMatch(/desk-build/);
    expect(existsSync(join(process.cwd(), "public/about/desk-build.mp4"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/about/desk-build.jpg"))).toBe(true);
  });
  test("videos loop and have a poster; every file exists under public/; every picture has an alt", () => {
    for (const p of pictures()) {
      expect(p.alt.length).toBeGreaterThan(5);
      expect(existsSync(join(process.cwd(), "public", p.src))).toBe(true);
      if (p.src.endsWith(".mp4")) {
        expect(p.loop).toBe(true);
        expect(p.poster).toBeTruthy();
      }
      if (p.poster) expect(existsSync(join(process.cwd(), "public", p.poster))).toBe(true);
    }
  });
});
