// src/three/pendant/passes.ts
/**
 * The pendant's build passes (spec 2026-10-16-about-pendant-design.md §3): a sweep left to right across the pendant on
 * screen, brass (built) | clay | wire (not yet built). Pure maths, so the scene stays thin and the edges can be tested.
 */

/** Half the sweep's width, in pendant units (the pendant is 1 tall and about 0.4 wide). */
export const SWEEP_SPAN = 0.42;
/** At or past this the pendant is fully built: the clay and the wire go, the clips come off. */
export const BUILT_AT = 0.999;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface BuildEdges {
  /** Right of this (along the camera's right vector) is wire. */
  eA: number;
  /** Left of this is brass; between eB and eA is clay. */
  eB: number;
  /** False once the pendant is fully built (w >= BUILT_AT): nothing is clipped. */
  building: boolean;
}

/** Where the two edges stand for build progress `w` (0 = all wire, 1 = all brass). The clay edge lags the wire's by a third. */
export function buildEdges(w: number): BuildEdges {
  return {
    eA: -SWEEP_SPAN + 2 * SWEEP_SPAN * clamp01(1.5 * w),
    eB: -SWEEP_SPAN + 2 * SWEEP_SPAN * clamp01(1.5 * w - 0.5),
    building: w < BUILT_AT,
  };
}

/*
 * Patches to three's own post-processing shaders, for a see-through, premultiplied canvas. Pure string work, so a test can
 * run them against the installed three: a three upgrade that changes a shader's text must fail CI here, not drop the
 * pendant in production (each patch throws when its anchor is missing).
 */

/** BokehShader ends every pixel with alpha 1, which would paint the whole canvas opaque. */
export const BOKEH_OPAQUE_ALPHA = "gl_FragColor.a = 1.0;";
/** BokehShader's blur radius: the empty background is "far", so it would get the widest blur and gather the pendant into a halo. */
export const BOKEH_BLUR = "vec2 dofblur = vec2 ( clamp( factor * aperture, -maxblur, maxblur ) );";
/** OutputShader's read of the previous pass. */
export const OUTPUT_READ = "gl_FragColor = texture2D( tDiffuse, vUv );";

/** The bokeh fragment shader with alpha left alone, and the blur off where nothing is drawn (an out-of-focus part of the
 *  pendant still blurs inwards). */
export function patchBokeh(frag: string): string {
  if (!frag.includes(BOKEH_OPAQUE_ALPHA) || !frag.includes(BOKEH_BLUR)) {
    throw new Error("BokehShader changed: update the patches in passes.ts");
  }
  return frag
    .replace(BOKEH_OPAQUE_ALPHA, "")
    .replace(BOKEH_BLUR, `${BOKEH_BLUR}\n\t\t\tdofblur *= smoothstep( 0.0, 0.5, texture2D( tColor, vUv ).a );`);
}

/** The output fragment shader seeing plain colour: the scene is drawn premultiplied (the blend gives rgb x alpha) and so is the
 *  canvas, but tone mapping and the sRGB curve aren't linear, so the alpha comes off before them and goes back after (or every
 *  soft edge comes out bright, a halo round the pendant). */
export function patchOutput(frag: string): string {
  const end = frag.lastIndexOf("}");
  if (!frag.includes(OUTPUT_READ) || end < 0) throw new Error("OutputShader changed: update the premultiply patch in passes.ts");
  return (
    frag.slice(0, end).replace(OUTPUT_READ, `${OUTPUT_READ}\n\t\t\tgl_FragColor.rgb /= max( gl_FragColor.a, 1e-4 );`) +
    "\n\t\t\tgl_FragColor.rgb *= gl_FragColor.a;\n\t\t}"
  );
}
