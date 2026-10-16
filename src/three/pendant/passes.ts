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

/** Where the bokeh has no blur (nothing drawn there: most of the screen) it returns the pixel at once instead of reading it
 *  41 times: the same result, a fraction of the cost (Task 10's performance pass). */
export const BOKEH_EARLY_OUT = "if ( dofblur.x == 0.0 ) { gl_FragColor = texture2D( tColor, vUv ); return; }";

/** The bokeh fragment shader with alpha left alone, and the blur off where nothing is drawn (an out-of-focus part of the
 *  pendant still blurs inwards); a pixel with no blur skips the taps. */
export function patchBokeh(frag: string): string {
  if (!frag.includes(BOKEH_OPAQUE_ALPHA) || !frag.includes(BOKEH_BLUR)) {
    throw new Error("BokehShader changed: update the patches in passes.ts");
  }
  return frag
    .replace(BOKEH_OPAQUE_ALPHA, "")
    .replace(BOKEH_BLUR, `${BOKEH_BLUR}\n\t\t\tdofblur *= smoothstep( 0.0, 0.5, texture2D( tColor, vUv ).a );\n\t\t\t${BOKEH_EARLY_OUT}`);
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

/*
 * The brass as Liam approved it (storyboard about-pendant-storyboard-v1, about-pendant-opening-v2) was drawn by the
 * prototype on three r170. Between r170 and r186 three changed how a rough metal is shaded, and the brass came out paler:
 * more of it in the bright bands (the pale stripes down the flutes), its shadows lifted. Measured (lookfix-report.md): three
 * shading changes, plus RoomEnvironment's move (scene.ts), account for all of it; with them put back r186 draws what r170
 * drew. These patches put the three shading changes back, on the brass's own program only (via onBeforeCompile):
 *   1. the environment reflection bends toward the normal by roughness^2 (r186: roughness^4);
 *   2. the split-sum DFG term is r170's analytic fit (r186: a lookup table);
 *   3. no multiple-scattering boost on the direct lights (new in r186: up to +25% on a rough metal, tinted by its colour).
 */

/** Where the three chunks sit in MeshStandardMaterial's fragment shader. */
export const ENV_INCLUDE = "#include <envmap_physical_pars_fragment>";
export const BRDF_INCLUDE = "#include <lights_physical_pars_fragment>";
export const LIGHTS_INCLUDE = "#include <lights_fragment_begin>";
/** r186's reflection bend (1), its two DFG lookups (2), and its direct-light compensation (3). */
export const ENV_BEND = "reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );";
export const BRDF_LUT = "texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg";
export const LIGHTS_LUT = "texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg";
export const LIGHTS_MS = "material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );";
const DFG_UNIFORM = "uniform sampler2D dfgLUT;";

/** r170's DFGApprox ("Physically Based Shading on Mobile", Karis), as r170 shipped it. */
const DFG_APPROX = /* glsl */ `
vec2 dfgApproxR170( const in float dotNV, const in float roughness ) {
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	return vec2( - 1.04, 1.04 ) * a004 + r.zw;
}`;

/** The three chunks three would include, as the material needs them (three's ShaderChunk, passed in so a test can use it). */
export interface ShadingChunks {
  envmap_physical_pars_fragment: string;
  lights_physical_pars_fragment: string;
  lights_fragment_begin: string;
}

const swap = (src: string, anchor: string, by: string, what: string): string => {
  if (src.split(anchor).length !== 2) throw new Error(`three's ${what} changed: update the r170 shading patch in passes.ts`);
  return src.replace(anchor, () => by); // (a function: GLSL is never read as a $-pattern)
};

/** MeshStandardMaterial's fragment shader (from onBeforeCompile, includes not yet resolved) shaded as three r170 shaded it. */
export function patchShadingR170(frag: string, chunk: ShadingChunks): string {
  const env = swap(chunk.envmap_physical_pars_fragment, ENV_BEND,
    "reflectVec = normalize( mix( reflectVec, normal, roughness * roughness ) );", "envmap_physical_pars_fragment");
  const brdf = swap(swap(chunk.lights_physical_pars_fragment, DFG_UNIFORM, DFG_UNIFORM + DFG_APPROX, "lights_physical_pars_fragment"),
    BRDF_LUT, "dfgApproxR170( dotNV, roughness )", "lights_physical_pars_fragment");
  const lights = swap(swap(chunk.lights_fragment_begin, LIGHTS_LUT, "dfgApproxR170( dotNVms, material.roughness )", "lights_fragment_begin"),
    LIGHTS_MS, "material.multiScatteringCompensation = vec3( 1.0 );", "lights_fragment_begin");
  let out = swap(frag, ENV_INCLUDE, env, "MeshStandardMaterial shader");
  out = swap(out, BRDF_INCLUDE, brdf, "MeshStandardMaterial shader");
  return swap(out, LIGHTS_INCLUDE, lights, "MeshStandardMaterial shader");
}
