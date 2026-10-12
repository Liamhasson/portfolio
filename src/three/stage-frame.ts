// src/three/stage-frame.ts
/** One frame: every callback, then the draw. A throw stops the frame there and comes back to the caller (the stage hands
 *  it to its onCrash listeners: the story falls back to its stills instead of a frozen, possibly locked page). */
export function stepFrame(callbacks: Iterable<(dt: number, t: number) => void>, dt: number, t: number, draw: () => void): unknown {
  try {
    for (const cb of callbacks) cb(dt, t);
    draw();
    return null;
  } catch (e) {
    return e;
  }
}
