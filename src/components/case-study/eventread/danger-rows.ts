import {
  BERLIN_EVENTS, BERLIN_SHOW, band, capacityScore, dangerScore, genreWeight, timingWeight,
  type Band, type CompetingEvent, type YourShow,
} from "@/lib/danger-score";

/** The Danger Score demo's rows: the live product's own Berlin example, scored by the engine in src/lib/danger-score.ts
    (a port of Eventread's lib/dangerScore.ts) for whatever show the controls describe. */
export interface DangerRow {
  ev: string;
  venue: string;
  cap: string;
  genreName: string;
  time: string;
  band: Band;
  capacity: number;
  genre: number;
  timing: number;
  why: [string, string, string];
}

const n = (v: number) => v.toLocaleString("en-US");
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

function genreWhy(e: CompetingEvent, yours: string, weight: number): string {
  if (weight === 1) return `${e.genre}, same genre`;
  if (weight === 0.8) return `${e.genre}, close to ${yours}`;
  if (weight === 0.5) return `${e.genre}, adjacent to ${yours}`;
  return `${e.genre}, loosely related`;
}

function timingWhy(e: CompetingEvent, yours: string): string {
  const diff = Math.abs(minutes(yours) - minutes(e.time));
  if (diff === 0) return `${e.time}, same start`;
  if (diff <= 120) return `${e.time}, within 2 h`;
  if (diff <= 360) return `${e.time}, within 6 h`;
  return `${e.time}, over 6 h apart`;
}

export function rowsFor(show: YourShow): DangerRow[] {
  return BERLIN_EVENTS.map((e) => {
    const genre = genreWeight(show.genre, e.genre, e.category);
    return {
      ev: e.name.replace(" — ", " - "),
      venue: e.venue,
      cap: n(e.capacity),
      genreName: e.genre,
      time: e.time,
      band: band(dangerScore(e, show)),
      capacity: capacityScore(e.capacity, show.capacity),
      genre,
      timing: timingWeight(show.startTime, e.time),
      why: [`${n(e.capacity)} vs your ${n(show.capacity)}`, genreWhy(e, show.genre, genre), timingWhy(e, show.startTime)],
    };
  });
}

export const DANGER_ROWS: readonly DangerRow[] = rowsFor(BERLIN_SHOW);

/** The capacity slider runs 0-100 on a log scale, so its ticks (100, 1,000, 10,000) sit at the two ends and the middle. */
export const capacityAt = (pos: number) => Math.round((100 * 10 ** (pos / 50)) / 50) * 50;

export const BAND_CLASS: Record<Band, string> = { Critical: "crit", Threat: "threat", Safe: "safe" };
export const f1 = (v: number) => v.toFixed(1);
