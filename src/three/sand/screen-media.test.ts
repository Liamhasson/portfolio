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
