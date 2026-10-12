// src/content/about.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ABOUT, CONTACT, plain } from "./about";

const approved = readFileSync(join(process.cwd(), "docs/copy/about.md"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

describe("About and Contact content (spec 2026-10-12-about-contact-design.md)", () => {
  test("Liam's approved text, verbatim, in order: three lines on the track, the last one closing it", () => {
    expect([...ABOUT.lines.map(plain), plain(ABOUT.closing)]).toEqual(approved);
  });
  test("two colours: the highlights are exactly the spec's table", () => {
    const his = (l: { t: string; hi?: boolean }[]) => l.filter((s) => s.hi).map((s) => s.t);
    expect(his(ABOUT.lines[0])).toEqual(["I’m Liam. I love crafting products"]);
    expect(his(ABOUT.lines[1])).toEqual(["ten years managing two rock bands", "making something out of nothing"]);
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
    expect(ABOUT.resume.href).toBe("https://drive.google.com/file/d/1WyoDYw5Zarn3N2031RGNSLrdmAiR0yJS/view?usp=sharing");
    expect(CONTACT).toEqual({ headline: "Got something on your mind?", email: "Liamhasson@gmail.com", linkedin: "https://www.linkedin.com/in/liamhasson/", phone: "+49 160 771 0652" });
  });
});
