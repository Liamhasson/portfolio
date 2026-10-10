import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

test.each(["eventread", "cyvore", "pulse"])(
  "%s middle blocks follow the frame order: problem, signature, supporting",
  (slug) => {
    const source = readFileSync(path.join(__dirname, `${slug}.mdx`), "utf8");
    const kinds = [...source.matchAll(/kind="([^"]+)"/g)].map((m) => m[1]);
    expect(kinds).toEqual(["problem", "signature", "supporting"]);
    const titles = [...source.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
    expect(titles).toEqual(["Problem", "Solution", "How it works"]);
  },
);
