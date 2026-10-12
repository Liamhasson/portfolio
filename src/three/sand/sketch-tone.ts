/**
 * The sketches' tone (Liam, 2026-10-12: "hatching + soft tone"): graphite rubbed in with a finger, into the sketch's
 * texture. Clipped to its uneven outline, a faint even base, then soft streaks at the hatching's angle, each a little
 * stronger or weaker. Never stronger than 35% of its strength: a tone, never a light (no glow anywhere). In the
 * canvas's pixels: `ppu` pixels a unit, the texture's corner at (ox, oy) in the sketch's units. Self-contained (no
 * imports), so the mockup can embed it as is.
 */
export function rubTone(g: CanvasRenderingContext2D, pts: [number, number][], alpha: number, ppu: number, ox: number, oy: number, seed: number): void {
  let s = (seed * 9301 + 49297) % 233280;
  const R = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const X = (x: number) => (x - ox) * ppu, Y = (y: number) => (y - oy) * ppu;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  g.save();
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
  g.closePath();
  g.clip();
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineCap = "round";
  g.globalAlpha = alpha * 0.12;
  g.fill();
  // the streaks: across the area at about the hatching's angle
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, D = Math.hypot(x1 - x0, y1 - y0) / 2;
  for (let d = -D; d < D; d += 1.1 + R() * 1.2) {
    const a = -0.95 + (R() - 0.5) * 0.25, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const t0 = -D * (0.6 + R() * 0.5), t1 = D * (0.6 + R() * 0.5);
    g.globalAlpha = alpha * (0.06 + R() * 0.29);
    g.lineWidth = (0.8 + R() * 2.4) * ppu;
    g.beginPath();
    g.moveTo(X(cx + nx * d + ux * t0), Y(cy + ny * d + uy * t0));
    g.lineTo(X(cx + nx * d + ux * t1), Y(cy + ny * d + uy * t1));
    g.stroke();
  }
  g.restore();
}
