// src/app/lab/sand/loader-mode.test.ts
import { describe, expect, test } from "vitest";
import { LOADER_BOOT, loaderMode, readLoaderMode } from "./loader-mode";

describe("when the loader plays (spec §3; Liam, 2026-10-12: every fresh page load)", () => {
  test("every fresh page load of the hero plays it; under reduced motion: reduced", () => {
    expect(loaderMode({ hash: "", reduced: false })).toBe("play");
    expect(loaderMode({ hash: "", reduced: true })).toBe("reduced");
  });
  test("deep links past the hero: a fade from black", () => {
    for (const h of ["#projects", "#about", "#contact"]) expect(loaderMode({ hash: h, reduced: false })).toBe("fade");
    expect(loaderMode({ hash: "#elsewhere", reduced: false })).toBe("play");
  });
  test("?loader plays it even past the hero, still honouring reduced motion", () => {
    expect(loaderMode({ hash: "#projects", reduced: false, replay: true })).toBe("play");
    expect(loaderMode({ hash: "#projects", reduced: true, replay: true })).toBe("reduced");
  });
  test("the boot script sets html[data-loader] from the same rules: a reload plays it again, a deep link fades", () => {
    document.documentElement.removeAttribute("data-loader");
    window.history.replaceState(null, "", "/lab/sand?hero");
    new Function(LOADER_BOOT)();
    expect(["play", "reduced"]).toContain(document.documentElement.dataset.loader);
    new Function(LOADER_BOOT)();
    expect(["play", "reduced"]).toContain(document.documentElement.dataset.loader);
    window.history.replaceState(null, "", "/lab/sand?hero#projects");
    new Function(LOADER_BOOT)();
    expect(document.documentElement.dataset.loader).toBe("fade");
    window.history.replaceState(null, "", "/lab/sand?hero&loader#projects");
    new Function(LOADER_BOOT)();
    expect(document.documentElement.dataset.loader).toBe("play");
    window.history.replaceState(null, "", "/");
  });

  test("it survives React rebuilding the page (a browser extension edits the DOM, hydration fails and the html's attributes are reset): the mode is read from a value React can't touch, and the hold is re-applied", () => {
    window.history.replaceState(null, "", "/lab/sand?hero");
    new Function(LOADER_BOOT)();
    delete document.documentElement.dataset.loader;   // (what React's client re-render does to <html>)
    expect(readLoaderMode()).toBe("play");
    expect(document.documentElement.dataset.loader).toBe("play");
    window.history.replaceState(null, "", "/");
  });
  test("without the boot script (a client-side arrival): none", () => {
    delete (window as unknown as { __loaderMode?: string }).__loaderMode;
    delete document.documentElement.dataset.loader;
    expect(readLoaderMode()).toBe("none");
  });
});
