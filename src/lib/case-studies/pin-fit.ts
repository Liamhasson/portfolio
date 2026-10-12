/** A pinned story's place on screen (the Cyvore replica, the Pulse onboarding): centred when it fits below the site's
 *  fixed nav; else just below the nav at full size if it fits that way; else scaled down to sit between the nav and a
 *  16px margin (Liam, 2026-10-13: on short screens it used to slide up under the nav). */
export function pinFit(viewH: number, pinH: number, navClear: number, margin = 16): { top: number; scale: number } {
  const free = viewH - pinH;
  if (free / 2 >= navClear) return { top: free / 2, scale: 1 };
  if (navClear + pinH <= viewH - margin) return { top: navClear, scale: 1 };
  return { top: navClear, scale: Math.max(0.5, (viewH - margin - navClear) / pinH) };
}
