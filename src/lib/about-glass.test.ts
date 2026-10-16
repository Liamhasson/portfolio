// src/lib/about-glass.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { claimGlass, glassOwner, glassRim, resetGlassForTests, setGlassRim } from "./about-glass";

describe("about-glass: one ball between the testimonials, owned by whoever draws it", () => {
  afterEach(() => resetGlassForTests());

  it("glassOwner is testimonials until claimed, pendant after, testimonials after release", () => {
    expect(glassOwner()).toBe("testimonials");
    const release = claimGlass("pendant");
    expect(glassOwner()).toBe("pendant");
    release();
    expect(glassOwner()).toBe("testimonials");
  });

  it("a release is its own: twice is harmless, and an older claim's release leaves a newer one standing", () => {
    const a = claimGlass("pendant");
    const b = claimGlass("pendant");
    a();
    a();
    expect(glassOwner()).toBe("pendant");
    b();
    expect(glassOwner()).toBe("testimonials");
  });

  it("the test reset drops every claim and the rim", () => {
    claimGlass("pendant");
    setGlassRim([1, 1, 1]);
    resetGlassForTests();
    expect(glassOwner()).toBe("testimonials");
    expect(glassRim()).toBeNull();
  });

  it("rim colour round-trips and clears with null", () => {
    expect(glassRim()).toBeNull();
    setGlassRim([1, 0.53, 0.88]);
    expect(glassRim()).toEqual([1, 0.53, 0.88]);
    setGlassRim(null);
    expect(glassRim()).toBeNull();
  });

  it("the rim is copied in: changing the caller's array later doesn't change it", () => {
    const rgb: [number, number, number] = [0.2, 0.4, 0.6];
    setGlassRim(rgb);
    rgb[0] = 1;
    expect(glassRim()).toEqual([0.2, 0.4, 0.6]);
  });
});
