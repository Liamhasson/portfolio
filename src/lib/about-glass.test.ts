// src/lib/about-glass.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { claimGlass, glassLight, glassOwner, resetGlassForTests, setGlassLight, showGlassSlot, slotScrollFix } from "./about-glass";

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

  it("the scroll kept as the slot changes height: only wholly above the screen, and only where nothing anchors the scroll", () => {
    // opening 195 px with the slot wholly above the screen (top −600, its open foot at −405): scrolled by the change
    expect(slotScrollFix(-600, 0, 195, false)).toBe(195);
    // its open foot just at the screen's top: still wholly above
    expect(slotScrollFix(-195, 0, 195, false)).toBe(195);
    // straddling the screen's top once open: everything on screen is below its top, so scrolled by its whole growth and the
    // quote being read isn't pushed
    expect(slotScrollFix(-100, 0, 195, false)).toBe(195);
    expect(slotScrollFix(-1, 0, 195, false)).toBe(195);
    // its top on the screen, or below it: the reader sees it open, nothing to keep
    expect(slotScrollFix(0, 0, 195, false)).toBe(0);
    expect(slotScrollFix(300, 0, 195, false)).toBe(0);
    // closing while it reaches onto the screen: unchanged, nothing to keep
    expect(slotScrollFix(-100, 195, 0, false)).toBe(0);
    // closing wholly above: scrolled back by the change
    expect(slotScrollFix(-600, 195, 0, false)).toBe(-195);
    // the browser anchors the scroll itself (Chromium, Firefox): never a second correction
    expect(slotScrollFix(-600, 0, 195, true)).toBe(0);
    // no change of height (the track's slot is the same size either way)
    expect(slotScrollFix(-600, 170, 170, false)).toBe(0);
  });

  it("showGlassSlot scrolls by the slot's change in the same call, only where the browser doesn't anchor", () => {
    const g = globalThis as unknown as { CSS?: unknown };
    const css = g.CSS;
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const make = () => {
      const sec = { dataset: {} as DOMStringMap, querySelector: () => slot as unknown as Element };
      // (closed, the slot is display: none: a rect of zeros; open, wholly above the screen)
      const slot = { getBoundingClientRect: () => (sec.dataset.glass === "on" ? { top: -600, height: 195 } : { top: 0, height: 0 }) };
      return sec;
    };
    try {
      g.CSS = { supports: () => false }; // (iOS Safari: no overflow-anchor)
      resetGlassForTests();
      const sec = make();
      showGlassSlot(sec, "testimonials", true);
      expect(scrollBy).toHaveBeenCalledWith(0, 195);
      showGlassSlot(sec, "pendant", true); // (no change of the attribute: nothing more)
      expect(scrollBy).toHaveBeenCalledTimes(1);
      // closing, wholly above: scrolled back by its height
      showGlassSlot(sec, "pendant", false);
      showGlassSlot(sec, "testimonials", false);
      expect(scrollBy).toHaveBeenLastCalledWith(0, -195);
      expect(scrollBy).toHaveBeenCalledTimes(2);
      g.CSS = { supports: (p: string, v: string) => p === "overflow-anchor" && v === "auto" }; // (Chromium)
      resetGlassForTests();
      showGlassSlot(make(), "testimonials", true);
      expect(scrollBy).toHaveBeenCalledTimes(2);
    } finally {
      g.CSS = css;
      scrollBy.mockRestore();
    }
  });
});
