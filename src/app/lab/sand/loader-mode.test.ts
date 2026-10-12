// src/app/lab/sand/loader-mode.test.ts
import { describe, expect, test } from "vitest";
import { LOADER_BOOT, SEEN_KEY, loaderMode, markSeen, readSeen } from "./loader-mode";

describe("when the loader plays (spec §3)", () => {
  test("first arrival on the hero: play; under reduced motion: reduced", () => {
    expect(loaderMode({ seen: false, hash: "", reduced: false })).toBe("play");
    expect(loaderMode({ seen: false, hash: "", reduced: true })).toBe("reduced");
  });
  test("later arrivals in the session and deep links past the hero: a fade from black", () => {
    expect(loaderMode({ seen: true, hash: "", reduced: false })).toBe("fade");
    for (const h of ["#projects", "#about", "#contact"]) expect(loaderMode({ seen: false, hash: h, reduced: false })).toBe("fade");
    expect(loaderMode({ seen: false, hash: "#elsewhere", reduced: false })).toBe("play");
  });
  test("?loader replays it (to watch it again), still honouring reduced motion", () => {
    expect(loaderMode({ seen: true, hash: "", reduced: false, replay: true })).toBe("play");
    expect(loaderMode({ seen: true, hash: "#projects", reduced: true, replay: true })).toBe("reduced");
    document.documentElement.removeAttribute("data-loader");
    sessionStorage.setItem(SEEN_KEY, "1");
    window.history.replaceState(null, "", "/lab/sand?hero&loader");
    new Function(LOADER_BOOT)();
    expect(document.documentElement.dataset.loader).toBe("play");
    window.history.replaceState(null, "", "/");
    sessionStorage.removeItem(SEEN_KEY);
  });
  test("storage that throws (Safari private mode) never breaks it: not seen, and marking is a no-op", () => {
    const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readSeen(bad)).toBe(false);
    expect(() => markSeen(bad)).not.toThrow();
    expect(readSeen(null)).toBe(false);
  });
  test("seen once marked", () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(readSeen(s)).toBe(false);
    markSeen(s);
    expect(m.get(SEEN_KEY)).toBe("1");
    expect(readSeen(s)).toBe(true);
  });
  test("the boot script sets html[data-loader] from the same rules, without throwing", () => {
    document.documentElement.removeAttribute("data-loader");
    sessionStorage.removeItem(SEEN_KEY);
    new Function(LOADER_BOOT)();
    expect(["play", "reduced"]).toContain(document.documentElement.dataset.loader);
    sessionStorage.setItem(SEEN_KEY, "1");
    new Function(LOADER_BOOT)();
    expect(document.documentElement.dataset.loader).toBe("fade");
  });
});
