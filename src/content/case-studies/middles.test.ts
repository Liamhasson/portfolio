import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/** The frame order: problem, signature, supporting. Eventread adds its design system as a second supporting block
    (Liam, 2026-10-11: its own section, replacing challenge 03). */
const MIDDLES: Record<string, [string, string][]> = {
  eventread: [["problem", "Problem"], ["signature", "Solution"], ["supporting", "How it works"], ["supporting", "Design system"]],
  cyvore: [["problem", "Problem"], ["signature", "Solution"], ["supporting", "How it works"]],
  pulse: [["problem", "Problem"], ["signature", "Solution"], ["supporting", "How it works"]],
  "nordic-logic": [["problem", "Problem"], ["signature", "Solution"], ["supporting", "How it works"]],
};

test.each(Object.keys(MIDDLES))("%s middle blocks follow the frame order", (slug) => {
  const source = readFileSync(path.join(__dirname, `${slug}.mdx`), "utf8");
  const kinds = [...source.matchAll(/kind="([^"]+)"/g)].map((m) => m[1]);
  const titles = [...source.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
  expect(kinds.map((k, i) => [k, titles[i]])).toEqual(MIDDLES[slug]);
});
