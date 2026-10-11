/**
 * The final grade over the 3D scene (the cinematic look, Liam 2026-10-11; previewed on the Blender renders as
 * ffmpeg's "vignette=PI/6, colorlevels=romin=0.043:gomin=0.035:bomin=0.031, noise=alls=3"), laid between the canvas
 * and the page's own text and controls, which stay crisp:
 *
 * - a vignette: cos^4 of the lens angle (PI/6) across the half-diagonal, as the renders' (corners at ~56%)
 * - the lift: a warm near-black (#0b0908) screened over everything at once: out = lift + in (1 - lift), the renders'
 *   output black level. A grain in shadow is lifted exactly as much as the background behind it (Liam's rule)
 * - a fine film grain, moving at 12 frames a second (still when motion is reduced); it also breaks up banding in
 *   the dark gradients of the haze
 *
 * Each layer is fixed on its own (no wrapper): a fixed wrapper is a stacking context, and blend modes inside one only
 * blend with its empty backdrop, not the canvas.
 */
export function FilmGrade() {
  return (
    <>
      <div
        aria-hidden
        data-testid="film-grade"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse farthest-corner at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.035) 25%, rgba(0,0,0,0.13) 50%, rgba(0,0,0,0.28) 75%, rgba(0,0,0,0.44) 100%)",
        }}
      />
      <div aria-hidden data-testid="film-grade" className="pointer-events-none fixed inset-0" style={{ background: "#0b0908", mixBlendMode: "screen" }} />
      <div
        aria-hidden
        data-testid="film-grade"
        className="film-grain pointer-events-none fixed"
        style={{ inset: "-192px", backgroundImage: "url(/lab/grain.png)", backgroundSize: "192px 192px", mixBlendMode: "overlay", opacity: 0.09 }}
      />
      <style>{`
        @keyframes film-grain { ${Array.from({ length: 8 }, (_, i) => `${(i * 100) / 8}% { transform: translate(${(i * 53) % 192}px, ${(i * 97) % 192}px); }`).join(" ")} }
        .film-grain { animation: film-grain 0.66s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) { .film-grain { animation: none; } }
      `}</style>
    </>
  );
}
