// src/app/about/glass-lean.ts
import type { Look } from "@/three/pendant/camera";

/**
 * The cursor's lean as the camera takes it (about-pendant.tsx): eased toward `keep` (PendantScene.glassLook, 1 / GLASS_MAG)
 * by the shot's `glass` while a ball is drawn, since the ball magnifies the lean and turns it over; the full lean whenever no
 * ball is drawn (the testimonials own it, or there is no slot), whatever the shot's `glass`. Writes into `out` and returns it.
 */
export function leanFor(look: Look, ballDrawn: boolean, glass: number, keep: number, out: Look): Look {
  const k = ballDrawn ? 1 - (1 - keep) * Math.min(Math.max(glass, 0), 1) : 1;
  out.x = look.x * k;
  out.y = look.y * k;
  return out;
}
