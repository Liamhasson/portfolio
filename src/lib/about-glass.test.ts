// src/lib/about-glass.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { claimGlass, glassLight, glassOwner, resetGlassForTests, setGlassLight, showGlassSlot } from "./about-glass";

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

  it("no allocation per frame: the store keeps one object of its own, rewritten by each set", () => {
    const l = { q: 0.2, t: 1, pulse: -1 };
    setGlassLight(l);
    const first = glassLight();
    expect(first).not.toBe(l);
    l.q = 0.9; l.t = 2;
    setGlassLight(l);
    expect(glassLight()).toBe(first);
    expect(glassLight()).toEqual({ q: 0.9, t: 2, pulse: -1 });
  });

  it("the stack's slot: open while either side shows it, collapsed only when neither does; one side never clears the other's", () => {
    const sec = { dataset: {} as DOMStringMap };
    showGlassSlot(sec, "pendant", true);
    expect(sec.dataset.glass).toBe("on");
    showGlassSlot(sec, "testimonials", true);
    showGlassSlot(sec, "pendant", false); // (the pendant gone: the light still draws its ball there)
    expect(sec.dataset.glass).toBe("on");
    showGlassSlot(sec, "pendant", false); // (twice is harmless)
    expect(sec.dataset.glass).toBe("on");
    showGlassSlot(sec, "testimonials", false);
    expect(sec.dataset.glass).toBeUndefined();
    // the light gone first, then the pendant
    showGlassSlot(sec, "testimonials", true);
    showGlassSlot(sec, "pendant", true);
    showGlassSlot(sec, "testimonials", false);
    expect(sec.dataset.glass).toBe("on");
    showGlassSlot(sec, "pendant", false);
    expect(sec.dataset.glass).toBeUndefined();
    // one section's showers are its own
    const other = { dataset: {} as DOMStringMap };
    showGlassSlot(sec, "pendant", true);
    showGlassSlot(other, "pendant", false);
    expect(sec.dataset.glass).toBe("on");
    expect(other.dataset.glass).toBeUndefined();
  });

  it("the slot's attribute is written only when it changes (called every frame)", () => {
    let writes = 0;
    const store: Record<string, string> = {};
    const dataset = new Proxy(store, { set: (t, k, v) => { writes++; t[k as string] = v; return true; } }) as DOMStringMap;
    const sec = { dataset };
    for (let i = 0; i < 5; i++) showGlassSlot(sec, "pendant", true);
    expect(writes).toBe(1);
  });
});
