import { expect, test } from "vitest";
import { BERLIN_EVENTS, BERLIN_SHOW, band, capacityScore, dangerScore, genreWeight, timingWeight } from "@/lib/danger-score";
import { DANGER_ROWS } from "./danger-rows";

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
