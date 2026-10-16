// src/lib/about-glass.ts
/**
 * The testimonials' glass ball is one ball (pendant spec §6, pictures spec §4.2), and two things on About can draw it: the
 * pendant's scene (a real refracting sphere the pendant is filmed through) and the testimonials' light shader (its own
 * ray-traced ball). Whichever is built first, one ball is drawn:
 *   - the pendant claims the glass once its scene is ready, and releases it on unmount or a lost context;
 *   - the testimonials draw their ball only while `glassOwner() === "testimonials"` (nobody has claimed it), and every frame
 *     tell the pendant the colour of the screen edge the ball faces (`setGlassRim`), so the pendant's ball catches it too.
 * A module-level store: no React, no DOM.
 */

export type GlassOwner = "pendant" | "testimonials";
export type Rgb = readonly [number, number, number];

/** Live claims, oldest first: the newest decides. */
const claims: { owner: GlassOwner }[] = [];
let rim: Rgb | null = null;

/** Takes the ball. Returns the release (its own claim only: calling it twice, or after a newer claim, is harmless). */
export function claimGlass(owner: GlassOwner): () => void {
  const claim = { owner };
  claims.push(claim);
  return () => {
    const i = claims.indexOf(claim);
    if (i >= 0) claims.splice(i, 1);
  };
}

/** Who draws the ball now: the newest live claim's owner, "testimonials" when nobody has claimed it. */
export function glassOwner(): GlassOwner {
  return claims.length ? claims[claims.length - 1].owner : "testimonials";
}

/** The edge light's colour where the ball faces it, sRGB 0..1 (as the testimonials' shader mixes it), or null for none. */
export function setGlassRim(rgb: Rgb | null): void {
  rim = rgb ? [rgb[0], rgb[1], rgb[2]] : null;
}

export function glassRim(): Rgb | null {
  return rim;
}

/** Tests only: every claim dropped and the rim cleared (the store is global, so a test must not leak a claim into the next). */
export function resetGlassForTests(): void {
  claims.length = 0;
  rim = null;
}
