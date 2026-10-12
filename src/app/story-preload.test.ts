// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { STORY_PRELOAD } from "./story-preload";
import { sandFiles, type SandMeta } from "@/three/sand/data";

test("the HTML starts the story's first files itself, before any script runs: the ones every tier loads, in the modes its loaders use (Liam, 2026-10-13: three.js and the sand waited for the main script)", () => {
  const meta = JSON.parse(readFileSync("public/lab/sand/sand.json", "utf8")) as SandMeta;
  const every = sandFiles(meta, 1).map(([f]) => `/lab/sand/${f}`);   // (the volumes and the first part: every tier's)
  const hrefs = STORY_PRELOAD.map((p) => p.href);
  for (const h of [...every, "/lab/sand/sand.json", "/lab/shot/camera.json", "/lab/sand/haze-hero.json", "/lab/grain.png", "/lab/sand/haze-hero.png"]) expect(hrefs).toContain(h);
  expect(hrefs).not.toContain("/lab/sand/sand_1.bin");   // (higher tiers' parts: not every visitor's)
  for (const p of STORY_PRELOAD) {
    expect(existsSync(`public${p.href}`), p.href).toBe(true);
    // (the same mode as the request that uses it, or the browser downloads it twice: fetch() and three's images are CORS)
    expect(p.crossOrigin).toBe("anonymous");
    expect(p.as).toBe(p.href.endsWith(".png") ? "image" : "fetch");
  }
});
