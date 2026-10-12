import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("the hero has no LIAM HASSON outline any more: the layer, its font and its wave are gone (Liam, 2026-10-12)", () => {
  expect(existsSync(`${process.cwd()}/src/three/sand/wordmark.ts`)).toBe(false);
  expect(readFileSync(`${process.cwd()}/src/app/lab/sand/sand-lab.tsx`, "utf8")).not.toMatch(/wordmark/i);
});
