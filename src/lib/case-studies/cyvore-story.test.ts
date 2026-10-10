import { describe, expect, test } from "vitest";
import {
  ATTACK_TRIM,
  BEATS,
  CAPTIONS,
  CHAPTERS,
  STATS,
  TOTAL_WEIGHT,
  beatAt,
  beatStart,
  captionAt,
  chapterFill,
  firstBeatOf,
  formatStat,
  scrubTime,
} from "./cyvore-story";

describe("beats", () => {
  test("twelve beats, chapters in story order", () => {
    expect(BEATS).toHaveLength(12);
    const order = BEATS.map((b) => b.chapter).filter((c, i, a) => a.indexOf(c) === i);
    expect(order).toEqual(["why", "risk", "attack", "powers"]);
    expect(CHAPTERS).toEqual(order);
  });

  test("why arrives closed, then opens its four columns in order", () => {
    expect(BEATS.slice(0, 5).map((b) => [b.kind, b.panel])).toEqual([
      ["arrive", null], ["open", 0], ["open", 1], ["open", 2], ["open", 3],
    ]);
  });

  test("risk opens its first statistic with the handover, then the rest in order", () => {
    expect(BEATS.slice(5, 9).map((b) => [b.kind, b.panel])).toEqual([
      ["handover", 0], ["open", 1], ["open", 2], ["open", 3],
    ]);
  });

  test("attack is scrubbed, powers builds, then the story releases", () => {
    expect(BEATS.slice(9).map((b) => [b.chapter, b.kind])).toEqual([
      ["attack", "scrub"], ["powers", "build"], ["powers", "release"],
    ]);
  });

  test("the attack beat is three units long so the video has room to scrub", () => {
    expect(BEATS[9].weight).toBe(3);
    expect(TOTAL_WEIGHT).toBe(15);
  });
});

describe("beatAt", () => {
  test("start and end of the pinned range", () => {
    expect(beatAt(0)).toEqual({ beat: 0, within: 0 });
    expect(beatAt(1)).toEqual({ beat: 11, within: 1 });
  });

  test("clamps progress outside 0–1", () => {
    expect(beatAt(-0.2).beat).toBe(0);
    expect(beatAt(1.4).beat).toBe(11);
  });

  test("halfway through the weighted attack beat", () => {
    const at = beatAt(beatStart(9) + 1.5 / 15);
    expect(at.beat).toBe(9);
    expect(at.within).toBeCloseTo(0.5);
  });

  test("every beat's start lands inside that beat", () => {
    for (let b = 0; b < BEATS.length; b++) expect(beatAt(beatStart(b) + 1e-6).beat).toBe(b);
  });
});

describe("chapters", () => {
  test("first beat of each chapter", () => {
    expect(CHAPTERS.map(firstBeatOf)).toEqual([0, 5, 9, 10]);
  });

  test("fill: past chapters full, future empty, current partial", () => {
    expect(chapterFill(6, 0.5)).toEqual({ why: 1, risk: 0.375, attack: 0, powers: 0 });
  });

  test("fill at the very end is complete everywhere", () => {
    expect(chapterFill(11, 1)).toEqual({ why: 1, risk: 1, attack: 1, powers: 1 });
  });
});

describe("stats", () => {
  test("formatted exactly like the site", () => {
    expect(STATS.map((s) => formatStat(s, 1))).toEqual(["2,535%", "83%", "967%", "15B"]);
  });

  test("count from zero", () => {
    expect(formatStat(STATS[0], 0)).toBe("0%");
  });

  test("eased: well past half the value at the time midpoint", () => {
    expect(parseInt(formatStat(STATS[1], 0.5), 10)).toBeGreaterThan(41);
  });
});

describe("attack", () => {
  test("captions appear at the recording's moments, in order", () => {
    expect(captionAt(0)).toBe(-1);
    expect(captionAt(3.2 - ATTACK_TRIM)).toBe(0);
    expect(captionAt(4.4 - ATTACK_TRIM)).toBe(1);
    expect(captionAt(6.7 - ATTACK_TRIM)).toBe(2);
    expect(CAPTIONS).toEqual(["A link lands in the call.", "Cyvore reads it.", "Blocked."]);
  });

  test("scrub reaches the end at 85% and holds the last frame", () => {
    expect(scrubTime(0, 7.6)).toBe(0);
    expect(scrubTime(0.85, 7.6)).toBeCloseTo(7.55);
    expect(scrubTime(1, 7.6)).toBeCloseTo(7.55);
  });

  test("scrub before the video has loaded stays at 0", () => {
    expect(scrubTime(0.5, NaN)).toBe(0);
    expect(scrubTime(0.5, 0)).toBe(0);
  });
});
