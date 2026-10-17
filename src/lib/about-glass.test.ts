// src/lib/about-glass.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { claimGlass, glassLight, glassOwner, resetGlassForTests, setGlassLight } from "./about-glass";

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

  it("resetGlassForTests clears the light", () => {
    claimGlass("pendant");
    setGlassLight({ q: 1, t: 3, pulse: 1 });
    resetGlassForTests();
    expect(glassOwner()).toBe("testimonials");
    expect(glassLight()).toBeNull();
  });

  it("glass light round-trips and clears with null", () => {
    expect(glassLight()).toBeNull();
    setGlassLight({ q: 0.3, t: 12.5, pulse: -1 });
    expect(glassLight()).toEqual({ q: 0.3, t: 12.5, pulse: -1 });
    setGlassLight(null);
    expect(glassLight()).toBeNull();
  });

  it("the light is copied in: changing the caller's object later doesn't change it", () => {
    const l = { q: 0.5, t: 1, pulse: 0.2 };
    setGlassLight(l);
    l.q = 1;
    expect(glassLight()).toEqual({ q: 0.5, t: 1, pulse: 0.2 });
  });
});
