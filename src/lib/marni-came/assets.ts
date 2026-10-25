/** Every Marni Came file the case study and the band site serve (built by tools/marni-came/build-assets.sh). */
const R = "/case-studies/marni-came";

export const MC_ASSETS = {
  /** Drop Dead live at Lido: the solo, then the drummer's view (Liam, 2026-10-20). */
  heroLoop: `${R}/video/hero-burn.mp4`,
  heroPoster: `${R}/video/hero-burn.jpg`,
  releaseLoop: `${R}/video/release-loop.mp4`,
  releasePoster: `${R}/video/release-loop.jpg`,
  releaseVideo: `${R}/video/after-heartbreaks.mp4`,
  releaseVideoPoster: `${R}/video/after-heartbreaks.jpg`,
  /** The playground's own file: Dopamine live at Badehaus (its poster graded to the brand). */
  dopamineVideo: "/playground/dopamine.mp4",
  dopamineVideoPoster: `${R}/video/dopamine.jpg`,
  wordmark: `${R}/logo/wordmark.svg`,
  wordmarkBone: `${R}/logo/wordmark-bone.svg`,
  wordmarkBlack: `${R}/logo/wordmark-black.svg`,
  wordmarkDistressed: `${R}/logo/wordmark-distressed.svg`,
  wordmarkDistressedBone: `${R}/logo/wordmark-distressed-bone.svg`,
  logoBurned: `${R}/logo/burned.jpg`,
  cover: `${R}/cover-after-heartbreaks.jpg`,
  /** The crowd shirt's back: the cut faces and the chorus (docs/marni-came/print/shirt-back.png on black). */
  shirtBack: `${R}/merch/shirt-back.jpg`,
  posters: { lido: `${R}/posters/lido.jpg`, badehaus24: `${R}/posters/badehaus-2024.jpg`, badehaus23: `${R}/posters/badehaus-2023.jpg`, endOfTerm: `${R}/posters/end-of-term.jpg` },
  moves: { burn: `${R}/moves/burn.jpg`, doubled: `${R}/moves/doubled.jpg`, lens: `${R}/moves/lens.jpg`, blowout: `${R}/moves/blowout.jpg` },
  switchPhoto: `${R}/switch.jpg`,
  /** Moments of the film-burn footage in the brand's amber (burnfx.py), for the switch's Burn and the Burn swatch. */
  burns: [0, 1, 2, 3, 4, 5].map((i) => `${R}/burn/${i}.jpg`),
  /** The After Heartbreaks video's own burned frames, for Imagery (sources in tools/marni-came/sources/burned). */
  burned: [0, 1, 2, 3, 4, 5].map((i) => `${R}/burned/${i}.jpg`),
  /** The burn moving on its own, screened over the band site's hero and the sound toggle. */
  burnLoop: `${R}/video/burn-loop.mp4`,
  /** A denser burn for the small sound toggle (its gaps are short, so 'on' always shows). */
  burnPill: `${R}/video/burn-pill.mp4`,
  /** The crowd during Dopamine at Badehaus, 4:5, for the Problem's half (Liam, 2026-10-21). */
  problemLoop: `${R}/video/problem-burn.mp4`,
  problemPoster: `${R}/video/problem-burn.jpg`,
  fanPhoto: `${R}/fan-lido.jpg`,
  glowAllowed: `${R}/glow-allowed.jpg`,
  /** The four of you in 'b&w clothes 2': Pedro, Sami, Liam, Rikki, left to right. */
  bandGroup: `${R}/band/group.jpg`,
  /** The Strategy section's references: Wikimedia Commons photos, graded (credits in tools/marni-came/sources/refs). */
  refs: { bowie: `${R}/refs/bowie.jpg`, cobain: `${R}/refs/cobain.jpg`, grohl: `${R}/refs/grohl.jpg`, maneskin: `${R}/refs/maneskin.jpg` },
  /** The meet-up before Badehaus 2024, for the moodboard. */
  backstage: `${R}/backstage.jpg`,
  /** The video's own doubles, by file; the moodboard's order and credits live with the component. */
  doubled: {
    "01": `${R}/doubled/01.jpg`, "02": `${R}/doubled/02.jpg`, "03": `${R}/doubled/03.jpg`, "04": `${R}/doubled/04.jpg`, "05": `${R}/doubled/05.jpg`,
    "06": `${R}/doubled/06.jpg`, "07": `${R}/doubled/07.jpg`, "08": `${R}/doubled/08.jpg`, "09": `${R}/doubled/09.jpg`, "10": `${R}/doubled/10.jpg`,
    tall: `${R}/doubled/tall.jpg`, sameFrame: `${R}/doubled/same-frame.jpg`,
  },
  tracks: {
    afterHeartbreaks: { src: `${R}/audio/after-heartbreaks.m4a`, peaks: `${R}/audio/after-heartbreaks.peaks.json` },
    dopamine: { src: `${R}/audio/dopamine.m4a`, peaks: `${R}/audio/dopamine.peaks.json` },
    /** The playground's own files. */
    youllBeYou: { src: "/playground/youll-be-you.m4a", peaks: "/playground/youll-be-you.peaks.json" },
  },
} as const;

/** Every path in the manifest, for the asset test. */
export function assetPaths(node: unknown = MC_ASSETS): string[] {
  if (typeof node === "string") return [node];
  if (node && typeof node === "object") return Object.values(node).flatMap((v) => assetPaths(v));
  return [];
}
