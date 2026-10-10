/**
 * The Cyvore case study's story replica, as rules with no DOM.
 *
 * Scroll picks the beat; the beat plays itself. Only the attack video follows
 * the scroll. The board compiles this file to docs/prototypes/cyvore-mockups/
 * cyvore-story.js (npm run build:board); Part C imports it directly.
 * Spec: docs/superpowers/specs/2026-10-10-cyvore-story-replica-design.md
 */
export const CHAPTERS = ["why", "risk", "attack", "powers"];
export const BEATS = [
    { chapter: "why", kind: "arrive", panel: null, weight: 1 },
    { chapter: "why", kind: "open", panel: 0, weight: 1 },
    { chapter: "why", kind: "open", panel: 1, weight: 1 },
    { chapter: "why", kind: "open", panel: 2, weight: 1 },
    { chapter: "why", kind: "open", panel: 3, weight: 1 },
    { chapter: "risk", kind: "handover", panel: 0, weight: 1 },
    { chapter: "risk", kind: "open", panel: 1, weight: 1 },
    { chapter: "risk", kind: "open", panel: 2, weight: 1 },
    { chapter: "risk", kind: "open", panel: 3, weight: 1 },
    // Three units: 7.6 seconds of video needs room to be scrubbed at a readable pace.
    { chapter: "attack", kind: "scrub", panel: null, weight: 3 },
    { chapter: "powers", kind: "build", panel: null, weight: 2 },
    { chapter: "powers", kind: "release", panel: null, weight: 1 },
];
export const TOTAL_WEIGHT = BEATS.reduce((sum, b) => sum + b.weight, 0);
const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
/** The beat a 0–1 progress through the pinned range falls in, and how far into it. */
export function beatAt(progress) {
    const p = clamp01(progress) * TOTAL_WEIGHT;
    let start = 0;
    for (let i = 0; i < BEATS.length; i++) {
        const end = start + BEATS[i].weight;
        if (p < end || i === BEATS.length - 1) {
            return { beat: i, within: clamp01((p - start) / BEATS[i].weight) };
        }
        start = end;
    }
    return { beat: BEATS.length - 1, within: 1 };
}
/** Where a beat starts, as 0–1 progress through the pinned range. */
export function beatStart(beat) {
    let units = 0;
    for (let i = 0; i < beat; i++)
        units += BEATS[i].weight;
    return units / TOTAL_WEIGHT;
}
export function firstBeatOf(chapter) {
    return BEATS.findIndex((b) => b.chapter === chapter);
}
/** How full each chapter's progress line is, 0–1. */
export function chapterFill(beat, within) {
    const fill = { why: 0, risk: 0, attack: 0, powers: 0 };
    for (const ch of CHAPTERS) {
        const own = BEATS.flatMap((b, i) => (b.chapter === ch ? [i] : []));
        const first = own[0];
        const last = own[own.length - 1];
        if (beat > last)
            fill[ch] = 1;
        else if (beat >= first) {
            const total = own.reduce((s, i) => s + BEATS[i].weight, 0);
            const done = own.reduce((s, i) => s + (i < beat ? BEATS[i].weight : 0), 0) + BEATS[beat].weight * within;
            fill[ch] = done / total;
        }
    }
    return fill;
}
/** The risk is real, as on the live site. */
export const STATS = [
    { value: 2535, suffix: "%" },
    { value: 83, suffix: "%" },
    { value: 967, suffix: "%" },
    { value: 15, suffix: "B" },
];
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
/** A statistic part-way through its count-up (t from 0 to 1). */
export function formatStat(stat, t) {
    return Math.round(stat.value * easeOutCubic(t)).toLocaleString("en-US") + stat.suffix;
}
/** The board's clip starts this far into the original recording; its opening is black. */
export const ATTACK_TRIM = 0.9;
/** When each caption starts, in seconds of the original recording (checked frame by frame). */
export const CAPTION_AT = [3.2, 4.4, 6.7];
export const CAPTIONS = ["A link lands in the call.", "Cyvore reads it.", "Blocked."];
/** The caption showing at a moment of the trimmed clip; −1 before the first. */
export function captionAt(clipSeconds) {
    const t = clipSeconds + ATTACK_TRIM;
    let shown = -1;
    CAPTION_AT.forEach((at, i) => {
        if (t >= at)
            shown = i;
    });
    return shown;
}
/**
 * Scroll position within the attack beat → seconds into the clip. The clip
 * reaches its end at 85% of the beat and holds there, so the BLOCK frame is
 * seen before the story moves on. Stays at 0 until the video's length is known.
 */
export function scrubTime(within, clipDuration) {
    if (!Number.isFinite(clipDuration) || clipDuration <= 0)
        return 0;
    const end = Math.max(clipDuration - 0.05, 0);
    return Math.min(clamp01(within) / 0.85, 1) * end;
}
