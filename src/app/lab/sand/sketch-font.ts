import { Caveat, Nothing_You_Could_Do } from "next/font/google";

/** The sketches' handwriting (desk-sketches.ts): Caveat, self-hosted by next/font, loaded only with the story. Like the
 *  outlined name, it is drawn in the 3D scene, not page text (the type rules: Geist for all text). */
export const sketchFont = Caveat({ subsets: ["latin"], weight: "500", display: "swap" });

/** The notes' stories' handwriting (note-story/; Liam, 2026-10-13: the readable pencil hand of the approved mockups).
 *  Drawn on canvas, not page text, like the sketches'. */
export const storyFont = Nothing_You_Could_Do({ subsets: ["latin"], weight: "400", display: "swap" });
