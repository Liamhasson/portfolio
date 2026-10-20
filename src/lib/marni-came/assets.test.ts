import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { MC_ASSETS, assetPaths } from "./assets";

const pub = (p: string) => path.join(process.cwd(), "public", p);

test("every Marni Came asset in the manifest exists in public/", () => {
  for (const p of assetPaths()) expect(existsSync(pub(p)), p).toBe(true);
});

test("peaks files match the playground's format", () => {
  for (const t of Object.values(MC_ASSETS.tracks)) {
    const d = JSON.parse(readFileSync(pub(t.peaks), "utf8"));
    expect(d.peaks).toHaveLength(160);
    expect(d.duration).toBeGreaterThan(60);
  }
});
