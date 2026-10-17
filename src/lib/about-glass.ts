// src/lib/about-glass.ts
/**
 * The testimonials' glass ball is one ball (pendant spec §6, pictures spec §4.2), and two things on About can draw it: the
 * pendant's scene (a real refracting sphere the pendant is filmed through) and the testimonials' light shader (its own
 * ray-traced ball). Whichever is built first, one ball is drawn:
 *   - the pendant claims the glass once its scene is ready, and releases it on unmount or a lost context;
 *   - the testimonials draw their ball only while `glassOwner() === "testimonials"` (nobody has claimed it), and every frame
 *     they draw tell the pendant the light's state (`setGlassLight`: its strength q, its own clock t, the arrival pulse), so
 *     the pendant's ball works out the same edge colours the light shows and glints in them.
 * A module-level store: no React, no DOM.
 */

export type GlassOwner = "pendant" | "testimonials";
/** The testimonials' light as the ball needs it: `q` its strength 0..1, `t` the light's own clock (s; the colour field turns
 *  on it, so both shaders agree). `pulse`, the arrival wave's phase (−1 none, else 0..1), is carried for later: the ball
 *  doesn't draw it. */
export type GlassLight = { q: number; t: number; pulse: number };

/** Live claims, oldest first: the newest decides. */
const claims: { owner: GlassOwner }[] = [];
/** The store's own copy (written in place each frame: no allocation), and whether there is a light. */
const light: GlassLight = { q: 0, t: 0, pulse: -1 };
let lit = false;

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

/** The light this frame, or null when it is off (q 0, not drawing, or gone). Its fields are copied into the store's own
 *  object, so the caller may reuse its own. */
export function setGlassLight(l: GlassLight | null): void {
  lit = l !== null;
  if (l) { light.q = l.q; light.t = l.t; light.pulse = l.pulse; }
}

/** The light as last set (the store's object, read-only: it is rewritten by the next set), or null. */
export function glassLight(): Readonly<GlassLight> | null {
  return lit ? light : null;
}

/** Tests only: every claim dropped and the light cleared (the store is global, so a test must not leak a claim into the next). */
export function resetGlassForTests(): void {
  claims.length = 0;
  lit = false;
}
