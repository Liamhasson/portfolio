// Port of lib/dangerScore.ts in the Eventread repo (2026-10-09). Keep the numbers in step with it.
// Danger Score = capacity × genre × timing × 100, shown to users as a band, never a number.

export interface CompetingEvent {
  name: string;
  venue: string;
  capacity: number;
  genre: string;
  time: string;
  category?: string;
}

export interface YourShow {
  capacity: number;
  genre: string;
  startTime: string;
}

export type Band = "Safe" | "Threat" | "Critical";

export function capacityScore(competing: number, yours: number): number {
  const mine = yours > 0 ? yours : 1500;
  if (!competing || !Number.isFinite(competing) || competing <= 0) return 0.6;
  const ratio = competing / mine;
  if (ratio > 5) return 1.0;
  if (ratio >= 2) return 0.8;
  if (ratio >= 0.5) return 0.6;
  return 0.3;
}

const normGenre = (s: string) => (s || "").trim().toLowerCase().replace(/-/g, " ");

const NEIGHBOURS: Record<string, string[]> = {
  rock: ["alternative", "indie", "punk", "metal", "hard rock", "classic rock"],
  metal: ["rock", "hard rock", "punk", "alternative"],
  electronic: ["techno", "house", "edm", "dance", "electro"],
  techno: ["electronic", "house", "dance", "edm"],
  house: ["electronic", "techno", "dance", "edm"],
  pop: ["r&b", "soul", "indie pop", "dance pop"],
  "hip hop": ["r&b", "rap", "soul"],
  jazz: ["blues", "soul", "funk"],
  classical: ["opera", "orchestral"],
  folk: ["country", "acoustic", "indie folk"],
  country: ["folk", "americana"],
  "r&b": ["soul", "pop", "hip hop"],
  soul: ["r&b", "jazz", "funk", "blues"],
  blues: ["jazz", "soul", "rock"],
  reggae: ["ska", "dancehall"],
};

const ADJACENT: Record<string, string[]> = {
  rock: ["pop", "country", "blues"],
  electronic: ["pop", "hip hop"],
  pop: ["rock", "electronic", "r&b"],
  "hip hop": ["pop", "electronic"],
  jazz: ["classical", "pop"],
  classical: ["jazz", "folk"],
};

const NON_MUSIC = ["sports", "theater", "theatre", "comedy", "arts", "family", "miscellaneous", "parade", "football"];

export function genreWeight(yours: string, theirs: string, category = ""): number {
  const u = normGenre(yours);
  const e = normGenre(theirs);
  const cat = normGenre(category);
  if (u === "all genres" || u === "") return 0.6;
  if (u === e) return 1.0;
  if (NEIGHBOURS[u]?.some((n) => e.includes(n) || n.includes(e))) return 0.8;
  if (u.length >= 3 && (e.includes(u) || u.includes(e))) return 0.8;
  if (ADJACENT[u]?.some((n) => e.includes(n) || n.includes(e))) return 0.5;
  if (NON_MUSIC.some((n) => e.includes(n) || cat.includes(n))) return 0.1;
  return 0.2;
}

const toMinutes = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

export function timingWeight(yourStart: string, theirs: string): number {
  if (!theirs) return 1.0;
  const diff = Math.abs(toMinutes(yourStart) - toMinutes(theirs));
  if (diff <= 120) return 1.0;
  if (diff <= 360) return 0.7;
  return 0.3;
}

export function dangerScore(event: CompetingEvent, show: YourShow): number {
  const score = Math.round(
    capacityScore(event.capacity, show.capacity) *
      genreWeight(show.genre, event.genre, event.category) *
      timingWeight(show.startTime, event.time) *
      100,
  );
  return Math.max(0, Math.min(100, score));
}

export function band(score: number): Band {
  if (score >= 70) return "Critical";
  if (score >= 40) return "Threat";
  return "Safe";
}

/** The live product's own example: a 1,000-cap rock show in Berlin, 18 Nov 2026, 20:00. */
export const BERLIN_SHOW: YourShow = { capacity: 1000, genre: "Rock", startTime: "20:00" };

export const BERLIN_EVENTS: readonly CompetingEvent[] = [
  { name: "Muse — The Wow! Signal Europa Tour", venue: "Uber Arena", capacity: 7366, genre: "Alternative", time: "20:00", category: "Music" },
  { name: "Horse Lords", venue: "Silent Green", capacity: 532, genre: "Rock", time: "20:00", category: "Music" },
  { name: "TAEMIN", venue: "Verti Music Hall", capacity: 3638, genre: "Other", time: "20:00", category: "Music" },
];
