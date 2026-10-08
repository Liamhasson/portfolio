import { describe, expect, test } from "vitest";
import { pickTier, settingsFor, parseTierOverride, type TierSignals } from "./tier";

const desktop: TierSignals = {
  isMobile: false,
  automated: false,
  cores: 10,
  memoryGb: 16,
  dpr: 2,
  maxTextureSize: 16384,
};

describe("pickTier", () => {
  test("a capable desktop is high", () => {
    expect(pickTier(desktop)).toBe("high");
  });
  test("a modest desktop is mid", () => {
    expect(pickTier({ ...desktop, cores: 4, memoryGb: 8, maxTextureSize: 8192 })).toBe("mid");
  });
  test("a weak desktop is low", () => {
    expect(pickTier({ ...desktop, cores: 2, memoryGb: 4, maxTextureSize: 4096 })).toBe("low");
  });
  test("a current phone is mid, a weak phone is low", () => {
    expect(pickTier({ ...desktop, isMobile: true, cores: 8, memoryGb: 8 })).toBe("mid");
    expect(pickTier({ ...desktop, isMobile: true, cores: 6, memoryGb: 4 })).toBe("mid");
    expect(pickTier({ ...desktop, isMobile: true, cores: 2, memoryGb: 2 })).toBe("low");
  });
  test("automated browsers get low so tests stay fast, unless overridden", () => {
    expect(pickTier({ ...desktop, automated: true })).toBe("low");
    expect(pickTier({ ...desktop, automated: true }, "high")).toBe("high");
  });
});

describe("settingsFor", () => {
  test("grain counts shrink with the tier", () => {
    expect(settingsFor("high", 2).grains).toBeGreaterThan(settingsFor("mid", 2).grains);
    expect(settingsFor("mid", 2).grains).toBeGreaterThan(settingsFor("low", 2).grains);
  });
  test("pixel ratio is capped per tier and never above the device ratio", () => {
    expect(settingsFor("high", 3).pixelRatio).toBe(2);
    expect(settingsFor("mid", 3).pixelRatio).toBe(1.5);
    expect(settingsFor("low", 3).pixelRatio).toBe(1);
    expect(settingsFor("high", 1).pixelRatio).toBe(1);
  });
  test("shadow march steps shrink with the tier; low has no antialiasing", () => {
    expect(settingsFor("high", 2).shadowSteps).toBeGreaterThan(settingsFor("mid", 2).shadowSteps);
    expect(settingsFor("mid", 2).shadowSteps).toBeGreaterThan(settingsFor("low", 2).shadowSteps);
    expect(settingsFor("low", 2).antialias).toBe(false);
    expect(settingsFor("high", 2).antialias).toBe(true);
  });
});

describe("parseTierOverride", () => {
  test("accepts a tier name from the query string, ignores anything else", () => {
    expect(parseTierOverride("?tier=high")).toBe("high");
    expect(parseTierOverride("?x=1&tier=low")).toBe("low");
    expect(parseTierOverride("?tier=ultra")).toBeUndefined();
    expect(parseTierOverride("")).toBeUndefined();
  });
});
