// src/three/sand/screen-media.test.ts
import { expect, test } from "vitest";
import * as THREE from "three";
import { mediaOn, screenMediaTexture } from "./baked-desk";

test("a card's loop on the laptop screen is mipmapped: far away it's drawn from its own smaller levels, never mixed with the screen's still (Liam, 2026-10-12: the Cyvore card showed the old still through it)", () => {
  const t = screenMediaTexture(document.createElement("video"));
  expect(t.generateMipmaps).toBe(true);
  expect(t.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  expect(t.flipY).toBe(false);
  expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
});

test("the still shows in a card's place only until its loop has a frame (never a black card)", () => {
  const v = (readyState: number) => ({ readyState }) as HTMLVideoElement;
  expect(mediaOn(v(0))).toBe(0);
  expect(mediaOn(v(1))).toBe(0);
  expect(mediaOn(v(2))).toBe(1);
  expect(mediaOn(v(4))).toBe(1);
  expect(mediaOn(null)).toBe(0);
});

test("the cards' media on the laptop screen have the index's rounded corners (Liam, 2026-10-13: sharp on the screen, rounded on the page)", async () => {
  const { readFileSync } = await import("node:fs");
  const { MEDIA_RADIUS } = await import("./baked-desk");
  const css = readFileSync("src/app/lab/sand/work-index.tsx", "utf8");
  const cqw = Number(css.match(/\.wi \.media \{ border-radius:([\d.]+)cqw; \}/)![1]);
  expect(MEDIA_RADIUS).toBeCloseTo(cqw / 100, 6);   // (a fraction of the index's width, as the page draws it)
});
