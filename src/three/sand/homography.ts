/**
 * The CSS matrix3d that maps an element's box (w x h, transform-origin 0 0) onto any quad on the screen: used to lay the
 * live index exactly over the laptop screen as the camera pushes in, so it can take over without a seam.
 * Corners in CSS px, in order: top-left, top-right, bottom-right, bottom-left.
 */
export type Pt = [number, number];

/** The 3x3 projective map (row-major h0..h8, h8 = 1) from the box's corners to the quad's. */
export function homography(w: number, h: number, quad: [Pt, Pt, Pt, Pt]): number[] {
  const src: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  // x' = (a x + b y + c) / (g x + h y + 1), y' = (d x + e y + f) / (g x + h y + 1): 8 equations, 8 unknowns
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const s = A.map((row, i) => row[8] / row[i]);
  return [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], 1];
}

/** As a CSS transform (with transform-origin 0 0). */
export function matrix3d(w: number, h: number, quad: [Pt, Pt, Pt, Pt]): string {
  const [a, b, c, d, e, f, g, hh, i] = homography(w, h, quad);
  // column-major 4x4: x' = a x + b y + c, y' = d x + e y + f, w' = g x + hh y + i (z untouched)
  return `matrix3d(${[a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, i].map((n) => +n.toFixed(9)).join(",")})`;
}

/** Applies the map to a point (for tests and checks). */
export function mapPoint(H: number[], x: number, y: number): Pt {
  const wq = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / wq, (H[3] * x + H[4] * y + H[5]) / wq];
}
