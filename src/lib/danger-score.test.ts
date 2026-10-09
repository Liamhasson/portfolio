import { describe, expect, test } from "vitest";
import { BERLIN_EVENTS, BERLIN_SHOW, band, capacityScore, dangerScore, genreWeight, timingWeight } from "./danger-score";

describe("danger score factors", () => {
  test("capacity: competing room size relative to yours", () => {
    expect(capacityScore(7366, 1000)).toBe(1.0);
    expect(capacityScore(3638, 1000)).toBe(0.8);
    expect(capacityScore(532, 1000)).toBe(0.6);
    expect(capacityScore(400, 1000)).toBe(0.3);
    expect(capacityScore(0, 1000)).toBe(0.6);
  });

  test("genre: same, neighbour, adjacent, loose, non-music", () => {
    expect(genreWeight("Rock", "Rock")).toBe(1.0);
    expect(genreWeight("Rock", "Alternative")).toBe(0.8);
    expect(genreWeight("Rock", "Pop")).toBe(0.5);
    expect(genreWeight("Rock", "Other")).toBe(0.2);
    expect(genreWeight("Rock", "Comedy", "Arts")).toBe(0.1);
  });

  test("timing: within 2 hours, same evening, different session", () => {
    expect(timingWeight("20:00", "21:30")).toBe(1.0);
    expect(timingWeight("20:00", "15:00")).toBe(0.7);
    expect(timingWeight("20:00", "10:00")).toBe(0.3);
    expect(timingWeight("20:00", "")).toBe(1.0);
  });
});

describe("the Berlin example (eventread.vercel.app hero, 18 Nov 2026)", () => {
  test("matches the live product: Critical, Threat, Safe", () => {
    const scored = BERLIN_EVENTS.map((e) => ({ name: e.name, score: dangerScore(e, BERLIN_SHOW) }));
    expect(scored.map((s) => s.score)).toEqual([80, 60, 16]);
    expect(scored.map((s) => band(s.score))).toEqual(["Critical", "Threat", "Safe"]);
  });

  test("bands cut at 40 and 70", () => {
    expect(band(39)).toBe("Safe");
    expect(band(40)).toBe("Threat");
    expect(band(69)).toBe("Threat");
    expect(band(70)).toBe("Critical");
  });
});
