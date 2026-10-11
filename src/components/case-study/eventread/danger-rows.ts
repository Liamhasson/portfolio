import type { Band } from "@/lib/danger-score";

/** The board's three rows (eventread-mockups.html, frame 04), the live product's own Berlin example.
    danger-rows.test.ts checks every number against the engine in src/lib/danger-score.ts. */
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

export const DANGER_ROWS: readonly DangerRow[] = [
  { ev: "Muse - The Wow! Signal Europa Tour", venue: "Uber Arena", cap: "17,000", genreName: "Rock", time: "19:30", band: "Critical",
    capacity: 1.0, genre: 1.0, timing: 1.0, why: ["17,000 vs your 1,000", "Rock, same genre", "19:30, within 2 h"] },
  { ev: "Horse Lords", venue: "Silent Green", cap: "532", genreName: "Rock", time: "20:00", band: "Threat",
    capacity: 0.6, genre: 1.0, timing: 1.0, why: ["532 vs your 1,000", "Rock, same genre", "20:00, same start"] },
  { ev: "TAEMIN", venue: "Verti Music Hall", cap: "3,638", genreName: "Other", time: "20:00", band: "Safe",
    capacity: 0.8, genre: 0.2, timing: 1.0, why: ["3,638 vs your 1,000", "Other, unrelated", "20:00, same start"] },
];

export const BAND_CLASS: Record<Band, string> = { Critical: "crit", Threat: "threat", Safe: "safe" };
export const f1 = (n: number) => n.toFixed(1);
