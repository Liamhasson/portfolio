import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PIECES, ROWS, ROW_HEIGHT_VW } from "./pieces";

describe("the playground's pieces", () => {
  it("has a height for every row and unique ids", () => {
    expect(ROW_HEIGHT_VW).toHaveLength(ROWS.length);
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
  });

  it("points only at files that exist", () => {
    for (const p of PIECES) for (const f of [p.image, p.loop, p.video, p.audio, p.peaks]) {
      if (f) expect(existsSync(join(process.cwd(), "public", f)), `${p.id}: ${f}`).toBe(true);
    }
  });

  it("gives every piece something to open and a credit", () => {
    for (const p of PIECES) {
      expect(p.credit.length, p.id).toBeGreaterThan(5);
      expect(Boolean(p.youtube || p.video || p.audio || p.image), p.id).toBe(true);
    }
  });
});
