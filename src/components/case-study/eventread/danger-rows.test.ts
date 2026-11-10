import { expect, test } from "vitest";
import { BERLIN_EVENTS, BERLIN_SHOW, band, capacityScore, dangerScore, genreWeight, timingWeight } from "@/lib/danger-score";
import { DANGER_ROWS, capacityAt, rowsFor } from "./danger-rows";

test("the band's three rows are the live engine's numbers for the Berlin example", () => {
  expect(DANGER_ROWS).toHaveLength(BERLIN_EVENTS.length);
  DANGER_ROWS.forEach((row, i) => {
    const e = BERLIN_EVENTS[i];
    expect(row.capacity).toBe(capacityScore(e.capacity, BERLIN_SHOW.capacity));
    expect(row.genre).toBe(genreWeight(BERLIN_SHOW.genre, e.genre, e.category));
    expect(row.timing).toBe(timingWeight(BERLIN_SHOW.startTime, e.time));
    expect(Math.round(row.capacity * row.genre * row.timing * 100)).toBe(dangerScore(e, BERLIN_SHOW));
    expect(row.band).toBe(band(dangerScore(e, BERLIN_SHOW)));
  });
});

test("the demo's controls re-score the rows through the engine", () => {
  const show = { capacity: 200, genre: "Pop", startTime: "13:00" };
  rowsFor(show).forEach((row, i) => {
    const e = BERLIN_EVENTS[i];
    expect(row.band).toBe(band(dangerScore(e, show)));
    expect(row.timing).toBe(0.3);
    expect(row.genre).toBe(genreWeight("Pop", e.genre, e.category));
  });
  expect(rowsFor(show)[2].why).toEqual(["3,638 vs your 200", "Other, loosely related", "20:00, over 6 h apart"]);
});

test("the slider's ends and middle are its ticks", () => {
  expect([capacityAt(0), capacityAt(50), capacityAt(100)]).toEqual([100, 1000, 10000]);
});
