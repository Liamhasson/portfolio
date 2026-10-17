// src/lib/about-glass.ts
/**
 * The testimonials' glass ball is one ball (pendant spec §6, pictures spec §4.2), and two things on About can draw it: the
 * pendant's scene (a real refracting sphere the pendant is filmed through) and the testimonials' light shader (its own
 * ray-traced ball). Whichever is built first, one ball is drawn:
 *   - the pendant claims the glass once its scene is ready, and releases it on unmount or a lost context;
 *   - the testimonials draw their ball only while `glassOwner() === "testimonials"` (nobody has claimed it), and every frame
 *     they draw tell the pendant the light's state (`setGlassLight`: its strength q, its own clock t, the arrival pulse), so
 *     the pendant's ball works out the same edge colours the light shows and glints in them.
 * And the stack's glass slot (about.css: `data-glass="on"` on the section opens it) is shown by both, each for itself
 * (`showGlassSlot`): it opens while either one says it will draw the ball there, and collapses only when neither does, so
 * one side letting go never collapses the slot under the other's ball. Where the browser doesn't anchor the scroll (iOS
 * Safari), a slot that opens or closes wholly above the screen scrolls the page by its change, so what's on screen holds.
 * A module-level store: no React, and no DOM beyond the attribute `showGlassSlot` writes and that one correction.
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

/** Who shows each section's glass slot. */
let slotShowers = new WeakMap<object, Set<GlassOwner>>();

/**
 * The scroll that keeps the screen still as the slot changes height (px; 0 for none): its change, when the slot lies wholly
 * above the screen at its taller size (`top` its top on screen, before and after the same: nothing above it changes), and
 * only where the browser doesn't anchor the scroll itself (Chromium and Firefox do: a second correction would jump back).
 */
export function slotScrollFix(top: number, before: number, after: number, anchors: boolean): number {
  const delta = after - before;
  if (anchors || delta === 0) return 0;
  return top + Math.max(before, after) <= 0 ? delta : 0;
}

/** The browser anchors the scroll (CSS `overflow-anchor`); asked once. */
let anchorsAsked: boolean | null = null;
const anchors = () => (anchorsAsked ??= typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("overflow-anchor", "auto"));

/** The section as showGlassSlot needs it: its data attributes, and (in the page) its glass slot to keep the scroll by. */
export type GlassSection = { dataset: DOMStringMap; querySelector?: (sel: string) => Element | null };

/**
 * `who` shows the glass slot (on) or no longer does (off). The section carries `data-glass="on"` while anyone shows it, and
 * none once nobody does; the attribute is written only when it changes, so calling this every frame costs nothing. A change
 * of the slot's height wholly above the screen is scrolled away in the same task (slotScrollFix), where nothing else does.
 */
export function showGlassSlot(sec: GlassSection, who: GlassOwner, on: boolean): void {
  let showers = slotShowers.get(sec);
  if (on) {
    if (!showers) slotShowers.set(sec, (showers = new Set()));
    showers.add(who);
  } else showers?.delete(who);
  const open = !!showers && showers.size > 0;
  if (open === (sec.dataset.glass === "on")) return;
  const slot = anchors() ? null : sec.querySelector?.("[data-pendant='glass']") ?? null;
  const before = slot?.getBoundingClientRect();
  if (open) sec.dataset.glass = "on"; else delete sec.dataset.glass;
  if (!slot || !before) return;
  const after = slot.getBoundingClientRect();
  // (the slot's top where it is laid out: closed it is display: none, its rect all zeros, so after opening, before closing)
  const dy = slotScrollFix(open ? after.top : before.top, before.height, after.height, false);
  if (dy !== 0) window.scrollBy(0, dy);
}

/** Tests only: every claim dropped, the light cleared and nobody showing a slot (the store is global, so a test must not
 *  leak a claim into the next). */
export function resetGlassForTests(): void {
  claims.length = 0;
  lit = false;
  slotShowers = new WeakMap();
  anchorsAsked = null;
}
