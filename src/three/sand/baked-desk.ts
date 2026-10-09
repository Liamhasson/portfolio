import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { REVEAL, type RevealFrame } from "./screen-reveal";

/**
 * The desk as a real 3D object (lookdev.py --scene bakedesk), drawn the way Cycles drew the plates:
 *   - each surface's diffuse light is baked (Cycles, linear) into its own texture;
 *   - its sheen and reflections are computed live, per view, from a 360 probe of the room (the wood with its baked
 *     roughness and normals: grain, scratches), with each material's own settings from Blender;
 *   - the sum goes through Blender's exact view transform (AgX, look Punchy), captured as a 64^3 LUT (make_lut.py).
 * So the desk matches the plates from any camera, and camera moves need no rendering.
 * Placed in the hero's units like the plates: hero = (desk - chaos_center) / chaos_scale (the GLB is already y-up).
 */

interface MaterialMeta {
  color: number[];
  metallic: number;
  roughness: number;
  coat: number;
  coat_roughness: number;
  ior: number;
  specular: number;
  /** Its diffuse light per lighting state (v3: shut, open, lit); a single file in older bakes. */
  diff: string | { shut?: string; open?: string; lit?: string };
  rough?: string;
  normal?: string;
  /** All its light is baked (paper: translucency); no live reflection. */
  combined?: boolean;
  /** The laptop's screen: not baked, it shows the index (emission strength as in Blender). */
  screen?: boolean;
  emission?: number;
}

interface LightMeta {
  type: "SPOT" | "AREA" | "POINT";
  pos: number[];
  dir: number[];
  watts: number;
  color: number[];
  radius: number;
  /** "open": this light rises with the lid (the low view's fill). */
  follows?: string;
  spot_size?: number;
  blend?: number;
  size?: number;
  size_y?: number;
  shape?: string;
  up?: number[];
}

export interface BakedDeskMeta {
  version: number;
  encode: number;
  materials: Record<string, MaterialMeta>;
  probe: string;
  lut: string;
  chaos_center: [number, number, number];
  chaos_scale: number;
  /** The set's lights: close to the desk, so their reflections are drawn by real lights (only reflections: the
   *  dielectrics' base colour is black and their diffuse is baked). */
  lights?: Record<string, LightMeta>;
  /** The index on the laptop's screen. */
  screen?: string;
  /** The lid's parts hang under this node at the hinge, baked at this angle. */
  lid?: { pivot: string; baked_open_deg: number };
}

/**
 * Marks a material with a shader feature. three caches compiled programs by the text of onBeforeCompile, and every
 * wrapper here has the same text, so without this two materials with different features could share one program.
 */
function tagShader(material: THREE.Material, tag: string): void {
  const tags: string[] = (material.userData.shaderTags ??= []);
  tags.push(tag);
  material.customProgramCacheKey = () => tags.join("|");
}

/**
 * Blender's Specular IOR Level, as Cycles uses it: the reflectance at normal incidence is scaled (F0 = F0(ior) x 2 x
 * level) and turned back into an IOR, whose exact dielectric Fresnel applies at every angle. three's Schlick curve can't
 * follow a low IOR (the screen's glass, level 0.02, would read several times too glossy at an angle, or too dull at
 * grazing, whatever its F90), so the dielectrics use the exact Fresnel of that IOR (withExactFresnel).
 */
export function etaForLevel(level: number, ior = 1.5): number {
  const f0 = ((ior - 1) / (ior + 1)) ** 2 * 2 * level;
  const r = Math.sqrt(Math.min(Math.max(f0, 0), 0.999));
  return (1 + r) / (1 - r);
}

/** The exact unpolarised Fresnel reflectance of a dielectric (IOR eta, from outside) at cos(incidence) c. */
export function fresnelExact(c: number, eta: number): number {
  const s2 = (1 - c * c) / (eta * eta);
  if (s2 >= 1) return 1;
  const ct = Math.sqrt(1 - s2);
  const rs = (c - eta * ct) / (c + eta * ct), rp = (eta * c - ct) / (eta * c + ct);
  return 0.5 * (rs * rs + rp * rp);
}

const FRESNEL_EXACT = /* glsl */ `
uniform float uEta;    // > 0: this dielectric's exact Fresnel (Cycles), else three's Schlick
uniform float uFavg;   // its hemispherical average (multiple scattering)
float fresnelExact(float c, float eta) {
  float s2 = (1.0 - c * c) / (eta * eta);
  if (s2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - s2);
  float rs = (c - eta * ct) / (c + eta * ct), rp = (eta * c - ct) / (eta * c + ct);
  return 0.5 * (rs * rs + rp * rp);
}
`;
/** Replaces one match of `re` in three's chunk; throws if three's chunk no longer has it (an upgrade changed it). */
function patchChunk(src: string, re: RegExp, to: string): string {
  if (!re.test(src)) throw new Error(`baked-desk: three's shader chunk changed (${re.source.slice(0, 40)})`);
  return src.replace(re, to);
}
const PHYSICAL_PARS_EXACT = [
  // direct lights: the Fresnel of the half vector (the material BRDF, the one followed by iridescence)
  [/vec3 F = F_Schlick\( f0, f90, dotVH \);(\s*#ifdef USE_IRIDESCENCE\s*F = mix\( F, material\.iridescenceFresnel)/,
    "vec3 F = uEta > 0.0 ? vec3( fresnelExact( dotVH, uEta ) ) : F_Schlick( f0, f90, dotVH );$1"],
  // rect lights (LTC): the Fresnel at the view angle
  [/vec3 fresnel = \( material\.specularColorBlended \* t2\.x \+ \( material\.specularF90 - material\.specularColorBlended \) \* t2\.y \);/,
    "vec3 fresnel = uEta > 0.0 ? vec3( fresnelExact( saturate( dot( normal, viewDir ) ), uEta ) * t2.x ) : ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );"],
  // the room (split sum): the Fresnel at the view angle times the lobe's albedo, plus multiple scattering
  [/computeMultiscattering\( material\.dfg, material\.specularColor, material\.specularF90, singleScatteringDielectric, multiScatteringDielectric \);/,
    `if ( uEta > 0.0 ) {
      float Ess = material.dfg.x + material.dfg.y;
      vec3 FssEss = vec3( fresnelExact( saturate( dot( geometryNormal, geometryViewDir ) ), uEta ) * Ess );
      float Ems = 1.0 - Ess;
      vec3 Fms = FssEss * uFavg / ( 1.0 - Ems * uFavg );
      singleScatteringDielectric += FssEss;
      multiScatteringDielectric += Fms * Ems;
    } else {
      computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
    }`],
].reduce((src, [re, to]) => patchChunk(src, re as RegExp, to as string), THREE.ShaderChunk.lights_physical_pars_fragment);

/** A dielectric reflecting with the exact Fresnel of Blender's adjusted IOR (see etaForLevel). */
function withExactFresnel(material: THREE.Material, eta: number): void {
  tagShader(material, "fresnel");
  let favg = 0;   // 2 * integral of F(mu) mu dmu
  for (let i = 0; i < 256; i++) { const mu = (i + 0.5) / 256; favg += 2 * fresnelExact(mu, eta) * mu / 256; }
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.uEta = { value: eta };
    shader.uniforms.uFavg = { value: favg };
    shader.fragmentShader = FRESNEL_EXACT + shader.fragmentShader.replace("#include <lights_physical_pars_fragment>", PHYSICAL_PARS_EXACT);
  };
}

/** No light: the shut state of the parts the closed lid hides. */
const BLACK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLACK.needsUpdate = true;

const LUT_N = 64;
const LUT_MIN = -12.47393; // log2(2^-10 * 0.18)
const LUT_MAX = 4.026069; // log2(2^6.5 * 0.18)

/** Shared by every desk material: the lighting state (0..1 each) as the lid opens and the screen wakes. */
const STATE = { uOpen: { value: 0 }, uLit: { value: 0 } };

/**
 * What the desk's surfaces see of the moving parts, in view space (updated as the desk renders): the lid's rectangle
 * (a corner and its two edges), the screen's (its corner at UV 0,0 and the edges toward U and V, front normal), and the
 * ball and the lamp for the ball's shadow.
 */
const VIEW = {
  uLidO: { value: new THREE.Vector3() }, uLidU: { value: new THREE.Vector3() }, uLidV: { value: new THREE.Vector3() },
  uScrO: { value: new THREE.Vector3() }, uScrU: { value: new THREE.Vector3() }, uScrV: { value: new THREE.Vector3() },
  uScrN: { value: new THREE.Vector3() },
  uScrTex: { value: null as THREE.Texture | null },
  uScrGain: { value: 0 },
  uShBall: { value: new THREE.Vector3() }, uShBallR: { value: 1 },
  uShLamp: { value: new THREE.Vector3() }, uShLampR: { value: 1 }, uShK: { value: 0 },
  uLidDebug: { value: 0 },   // lab: 1 draws what the lid blocks (red)
};

/**
 * The lid blocks what the surfaces around it reflect, and its screen is what they see there instead. Live reflections
 * come from a probe of the room and the set's lights, neither of which knows the lid is there: as the lid rises, the
 * deck and keys would keep mirroring the rose rim light behind the laptop, where Cycles shows the lid's dark underside,
 * and once the screen wakes, its glow. So each surface's reflection ray is traced against the lid's rectangle (the edge
 * softened by the width of the surface's glossy lobe where it meets the lid) and the screen's (the index, blurred by the
 * same width).
 */
const LID_PASS = /* glsl */ `
// how much of a light at L reaches P past the lid (view space): 1 clear .. 0 behind it. The lid's edge is as soft as the
// light is wide where the ray crosses it (soft: the light's radius).
float lidPass(vec3 P, vec3 L, float soft) {
  vec3 nq = cross(uLidU, uLidV);
  vec3 d = L - P;
  float den = dot(d, nq);
  if (abs(den) < 1e-6) return 1.0;
  float t = dot(uLidO - P, nq) / den;
  if (t <= 0.0 || t >= 1.0) return 1.0;
  vec3 H = P + d * t - uLidO;
  float lu = length(uLidU), lv = length(uLidV);
  float u = dot(H, uLidU) / lu, v = dot(H, uLidV) / lv;
  float inside = min(min(u, lu - u), min(v, lv - v));
  float spread = max(soft * t, 0.02);
  return 1.0 - smoothstep(-spread, spread, inside);
}
`;
/** three's light loop, each light shadowed by the lid (the spot and point lights soft by the lamp's 0.2 m). */
const LIGHTS_BEGIN_LID = THREE.ShaderChunk.lights_fragment_begin
  .replace("getPointLightInfo( pointLight, geometryPosition, directLight );",
    "getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color *= lidPass( geometryPosition, pointLight.position, 2.0 );")
  .replace("getSpotLightInfo( spotLight, geometryPosition, directLight );",
    "getSpotLightInfo( spotLight, geometryPosition, directLight );\n\t\tdirectLight.color *= lidPass( geometryPosition, spotLight.position, 2.0 );")
  .replace("rectAreaLight = rectAreaLights[ i ];",
    "rectAreaLight = rectAreaLights[ i ];\n\t\trectAreaLight.color *= lidPass( geometryPosition, rectAreaLight.position, length( rectAreaLight.halfWidth ) );");

function withLidOcclusion(material: THREE.Material): void {
  tagShader(material, "lid");
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, VIEW);
    shader.fragmentShader =
      "uniform vec3 uLidO;\nuniform vec3 uLidU;\nuniform vec3 uLidV;\nuniform float uLidDebug;\n" +
      "uniform vec3 uScrO;\nuniform vec3 uScrU;\nuniform vec3 uScrV;\nuniform vec3 uScrN;\nuniform sampler2D uScrTex;\nuniform float uScrGain;\n" +
      LID_PASS +
      shader.fragmentShader.replace("#include <lights_fragment_begin>", LIGHTS_BEGIN_LID).replace(
        "#include <aomap_fragment>",
        `{
          vec3 P = -vViewPosition;
          vec3 R = reflect(-normalize(vViewPosition), normal);
          float lobe = max(material.roughness * material.roughness * 1.2, 0.02);   // the glossy lobe's spread per unit
          vec3 nq = cross(uLidU, uLidV);
          float den = dot(R, nq);
          float cover = 0.0;
          if (abs(den) > 1e-6) {
            float t = dot(uLidO - P, nq) / den;
            if (t > 0.0) {
              vec3 H = P + R * t - uLidO;
              float lu = length(uLidU), lv = length(uLidV);
              float u = dot(H, uLidU) / lu, v = dot(H, uLidV) / lv;
              float inside = min(min(u, lu - u), min(v, lv - v));          // distance to the nearest edge (+ inside)
              float spread = t * lobe;
              cover = smoothstep(-spread, spread, inside);
            }
          }
          reflectedLight.indirectSpecular *= 1.0 - cover;
          reflectedLight.directSpecular *= 1.0 - cover;
          #ifdef USE_CLEARCOAT
            clearcoatSpecularIndirect *= 1.0 - cover;
            clearcoatSpecularDirect *= 1.0 - cover;
          #endif
          // the screen, where the ray meets its front: the index as this surface would mirror it
          float dn = dot(R, uScrN);
          if (uScrGain > 0.0 && dn < -1e-4) {
            float ts = dot(uScrO - P, uScrN) / dn;
            if (ts > 0.0) {
              vec3 Hs = P + R * ts - uScrO;
              float lu = length(uScrU), lv = length(uScrV);
              vec2 st = vec2(dot(Hs, uScrU) / (lu * lu), dot(Hs, uScrV) / (lv * lv));
              float spread = ts * lobe;
              float inside = min(min(st.x * lu, (1.0 - st.x) * lu), min(st.y * lv, (1.0 - st.y) * lv));
              float on = smoothstep(-spread, spread, inside);
              float lod = log2(max(spread / lu * float(textureSize(uScrTex, 0).x), 1.0));
              vec3 scr = textureLod(uScrTex, clamp(st, 0.0, 1.0), lod).rgb * uScrGain;
              reflectedLight.indirectSpecular += on * scr
                * EnvironmentBRDF(normal, normalize(vViewPosition), material.specularColor, material.specularF90, material.roughness);
            }
          }
          if (uLidDebug > 0.5) {
            reflectedLight.indirectSpecular = vec3(0.0); reflectedLight.directSpecular = vec3(cover, 0.0, 0.0);
            #if NUM_RECT_AREA_LIGHTS > 0
            if (uLidDebug > 1.5) reflectedLight.directSpecular = vec3(0.0, 1.0 - lidPass(P, rectAreaLights[0].position, 1.0), 0.0);
            #endif
            totalEmissiveRadiance *= 0.3;
          }
        }
        #include <aomap_fragment>`,
      );
  };
}

/**
 * The ball's shadow, on whatever the lamp lights: for each point, the share of the lamp's disc the ball's disc hides (the
 * exact overlap of two discs, so it is as soft as Cycles' and falls where its does), taking that share of the lamp's
 * part of the baked light away. Surfaces facing away from the lamp are left alone.
 */
function withBallShadow(material: THREE.Material): void {
  tagShader(material, "shadow");
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, VIEW);
    shader.fragmentShader =
      "uniform vec3 uShBall;\nuniform float uShBallR;\nuniform vec3 uShLamp;\nuniform float uShLampR;\nuniform float uShK;\n" +
      shader.fragmentShader.replace(
        "#include <lights_physical_fragment>",
        `if (uShK > 0.0) {
          vec3 P = -vViewPosition;
          vec3 toB = uShBall - P, toL = uShLamp - P;
          float dB = length(toB), dL = length(toL);
          float facing = smoothstep(0.0, 0.2, dot(normal, toL / dL));
          if (dB < dL && facing > 0.0) {
            float r1 = asin(clamp(uShBallR / dB, 0.0, 1.0)), r2 = asin(clamp(uShLampR / dL, 0.0, 1.0));
            float d = acos(clamp(dot(toB / dB, toL / dL), -1.0, 1.0));
            float cover;
            if (d >= r1 + r2) cover = 0.0;
            else if (d <= abs(r1 - r2)) cover = min(r1 * r1, r2 * r2) / (r2 * r2);
            else {
              float c1 = clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0);
              float c2 = clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0);
              float area = r1 * r1 * acos(c1) + r2 * r2 * acos(c2)
                - 0.5 * sqrt(max((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2), 0.0));
              cover = area / (3.14159265 * r2 * r2);
            }
            totalEmissiveRadiance *= 1.0 - uShK * cover * facing;
          }
        }
        #include <lights_physical_fragment>`,
      );
  };
}

/**
 * Replaces three's tone mapping and colour-space output with Blender's view transform (scene-linear in, display out),
 * and blends the baked diffuse between the lighting states (shut -> open -> lit) when the other states are given.
 */
function withBlenderView(material: THREE.Material, lut: THREE.Data3DTexture, open?: THREE.Texture, lit?: THREE.Texture): void {
  tagShader(material, open || lit ? "view+states" : "view");
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLut = { value: lut };
    shader.uniforms.uOpen = STATE.uOpen;
    shader.uniforms.uLit = STATE.uLit;
    shader.uniforms.uDiffOpen = { value: open ?? null };
    shader.uniforms.uDiffLit = { value: lit ?? null };
    const blend = !!(open || lit);
    shader.fragmentShader =
      "uniform highp sampler3D uLut;\nuniform float uOpen;\nuniform float uLit;\nuniform sampler2D uDiffOpen;\nuniform sampler2D uDiffLit;\n" +
      shader.fragmentShader
        .replace(
          "#include <emissivemap_fragment>",
          blend
            ? `#ifdef USE_EMISSIVEMAP
              vec3 eShut = texture2D(emissiveMap, vEmissiveMapUv).rgb;
              vec3 eOpen = texture2D(uDiffOpen, vEmissiveMapUv).rgb;
              vec3 eLit = texture2D(uDiffLit, vEmissiveMapUv).rgb;
              totalEmissiveRadiance *= mix(mix(eShut, eOpen, uOpen), eLit, uLit);
              #endif`
            : "#include <emissivemap_fragment>",
        )
        .replace(
          "#include <tonemapping_fragment>",
          `{
            vec3 lx = clamp((log2(max(gl_FragColor.rgb, vec3(1e-10))) - (${LUT_MIN.toFixed(5)})) / ${(LUT_MAX - LUT_MIN).toFixed(5)}, 0.0, 1.0);
            gl_FragColor.rgb = texture(uLut, lx * ${((LUT_N - 1) / LUT_N).toFixed(6)} + ${(0.5 / LUT_N).toFixed(6)}).rgb;
          }`,
        )
        .replace("#include <colorspace_fragment>", "");
  };
}

const REV_N = REVEAL.elements.length;

/**
 * The laptop screen plays the index's first reveal: drawn from the finished index (the still), each animated element
 * taken out of its place and drawn back at its current opacity, offset and blur (a blur by mip level), under the wake's
 * black overlay. The background is flat, so this is exact up to the blur's shape.
 */
function withScreenReveal(material: THREE.Material, u: Record<string, THREE.IUniform>): void {
  tagShader(material, "reveal");
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader =
      `uniform vec4 uRevBox[${REV_N}];\nuniform vec3 uRevAnim[${REV_N}];\nuniform float uRevWake;\nuniform vec3 uRevBg;\n` +
      shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
        {
          vec2 suv = vEmissiveMapUv;
          vec3 col = texture2D(emissiveMap, suv).rgb;
          // the footprint the hardware would pick (texels), so a blurred read is never sharper than a plain one
          vec2 tsz = vec2(textureSize(emissiveMap, 0));
          vec2 ddx = dFdx(suv * tsz), ddy = dFdy(suv * tsz);
          float foot = sqrt(max(dot(ddx, ddx), dot(ddy, ddy)));
          for (int i = 0; i < ${REV_N}; i++) {
            vec4 b = uRevBox[i];
            if (all(greaterThanEqual(suv, b.xy)) && all(lessThan(suv, b.zw))) col = uRevBg;
          }
          for (int i = 0; i < ${REV_N}; i++) {
            vec4 b = uRevBox[i];
            vec3 a = uRevAnim[i];   // opacity, offset (screen heights), blur sigma (texels)
            if (a.x <= 0.0) continue;
            vec2 src = suv - vec2(0.0, a.y);
            if (any(lessThan(src, b.xy)) || any(greaterThanEqual(src, b.zw))) continue;
            float lod = log2(max(max(foot, a.z * 3.46), 1.0));
            col += a.x * (textureLod(emissiveMap, src, lod).rgb - uRevBg);
          }
          totalEmissiveRadiance *= col * (1.0 - uRevWake);
        }
        #endif`,
      );
  };
}

/**
 * The screen as a rectangle in the lid's pivot frame: the corners at UV (0,0), (1,0), (0,1) (a least-squares fit of
 * position = O + u U + v V over its vertices) and its front normal (the side the index shows on).
 */
function fitScreen(mesh: THREE.Mesh): THREE.Vector3[] {
  mesh.updateMatrix();
  const pos = mesh.geometry.getAttribute("position"), uv = mesh.geometry.getAttribute("uv"), nrm = mesh.geometry.getAttribute("normal");
  // normal equations for [1 u v] -> xyz
  const A = new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
  const a = A.elements;
  const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  const p = new THREE.Vector3(), nSum = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
    const r = [1, uv.getX(i), uv.getY(i)];
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) a[j * 3 + k] += r[j] * r[k];
    bx.addScaledVector(new THREE.Vector3(...r), p.x);
    by.addScaledVector(new THREE.Vector3(...r), p.y);
    bz.addScaledVector(new THREE.Vector3(...r), p.z);
    if (nrm) nSum.add(q.fromBufferAttribute(nrm, i));
  }
  A.transpose().invert();   // symmetric: transpose is a no-op, kept for clarity of layout
  const cx = bx.clone().applyMatrix3(A), cy = by.clone().applyMatrix3(A), cz = bz.clone().applyMatrix3(A);
  const O = new THREE.Vector3(cx.x, cy.x, cz.x), U = new THREE.Vector3(cx.y, cy.y, cz.y), V = new THREE.Vector3(cx.z, cy.z, cz.z);
  const n = nSum.transformDirection(mesh.matrix).normalize();
  return [O, O.clone().add(U), O.clone().add(V), n];
}

export class BakedDesk {
  readonly group = new THREE.Group();
  readonly materials: THREE.MeshPhysicalMaterial[] = [];
  readonly lights: { name: string; light: THREE.SpotLight | THREE.RectAreaLight | THREE.PointLight; base: number; follows?: string }[] = [];
  screen: { material: THREE.MeshPhysicalMaterial; emission: number; reveal: Record<string, THREE.IUniform> } | null = null;
  /** The lid on its hinge; its rectangle and the screen's, as corners (origin, along U, along V) in the pivot's frame. */
  private lid: { pivot: THREE.Object3D; q0: THREE.Quaternion; bakedDeg: number; corners: THREE.Vector3[]; screen: THREE.Vector3[] | null } | null = null;
  private readonly tmp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  /** The ball's shadow, in the hero's units (world): ball, its radius, the lamp, its radius, strength. */
  private readonly shadow = { ball: new THREE.Vector3(), ballR: 1, lamp: new THREE.Vector3(), lampR: 1, k: 0 };
  private viewStamp = -1;

  /** Carries the lid, the screen, the ball and the lamp into the camera's view space (as the desk renders, with the
   *  camera in use; once per camera pose). */
  private trackView = (camera: THREE.Camera): void => {
    const v = camera.matrixWorldInverse;
    const stamp = v.elements[12] + v.elements[13] * 3 + v.elements[14] * 7 + v.elements[0] * 11 + v.elements[5] * 13 + (this.lid?.pivot.quaternion.x ?? 0) * 17;
    if (stamp === this.viewStamp) return;
    this.viewStamp = stamp;
    const [o, a, b, n] = this.tmp;
    const rect = (c: THREE.Vector3[], O: THREE.Vector3, U: THREE.Vector3, V: THREE.Vector3, m: THREE.Matrix4) => {
      o.copy(c[0]).applyMatrix4(m).applyMatrix4(v);
      a.copy(c[1]).applyMatrix4(m).applyMatrix4(v);
      b.copy(c[2]).applyMatrix4(m).applyMatrix4(v);
      O.copy(o); U.subVectors(a, o); V.subVectors(b, o);
    };
    if (this.lid) {
      const m = this.lid.pivot.matrixWorld;
      rect(this.lid.corners, VIEW.uLidO.value, VIEW.uLidU.value, VIEW.uLidV.value, m);
      if (this.lid.screen) {
        rect(this.lid.screen, VIEW.uScrO.value, VIEW.uScrU.value, VIEW.uScrV.value, m);
        n.copy(this.lid.screen[3]).transformDirection(m).transformDirection(v);
        VIEW.uScrN.value.copy(n);
      }
    }
    VIEW.uShBall.value.copy(this.shadow.ball).applyMatrix4(v);
    VIEW.uShLamp.value.copy(this.shadow.lamp).applyMatrix4(v);
  };

  /** The ball's shadow on the desk and the laptop: ball centre and radius, lamp centre and radius (the hero's units),
   *  and the lamp's share of the light where it falls (0 for none). */
  setBallShadow(ball: THREE.Vector3, ballR: number, lamp: THREE.Vector3, lampR: number, k: number): void {
    const sh = this.shadow;
    sh.ball.copy(ball); sh.lamp.copy(lamp); sh.ballR = ballR; sh.lampR = lampR; sh.k = k;
    VIEW.uShBallR.value = ballR; VIEW.uShLampR.value = lampR; VIEW.uShK.value = k;
    this.viewStamp = -1;
  }

  /** The lid's angle in degrees (0 shut, ~108 open), turning on the hinge. */
  setLid(openDeg: number): void {
    if (!this.lid) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(this.lid.bakedDeg - openDeg));
    this.lid.pivot.quaternion.copy(this.lid.q0).multiply(q);
  }

  /** The lighting state: open (the lid open, the low view's fill) and lit (the screen glowing on the desk), 0..1. */
  setState(open: number, lit: number): void {
    STATE.uOpen.value = open;
    STATE.uLit.value = lit;
    for (const l of this.lights) if (l.follows === "open") l.light.intensity = l.base * open;
  }

  /** The screen: where the index's first reveal is (screen-reveal.ts revealAt); null for off. */
  setScreen(f: RevealFrame | null): void {
    if (!this.screen) return;
    const u = this.screen.reveal;
    u.uRevWake.value = f ? f.wake : 1;
    // what the deck and keys mirror of it: the finished index at the reveal's light
    VIEW.uScrGain.value = f ? this.screen.emission * f.light : 0;
    if (!f) return;
    const img = this.screen.material.emissiveMap?.image as { width?: number } | undefined;
    const texels = (img?.width ?? REVEAL.surface.width_px) / REVEAL.surface.width_px;   // the still's px per design px
    const anim = u.uRevAnim.value as THREE.Vector3[];
    f.elements.forEach((e, i) => anim[i].set(e.opacity, e.offset, e.blur * texels));
  }

  private constructor() {}

  /** Calibration: scale a light's (or every light's) power. */
  setLightGain(gain: number, name?: string): void {
    for (const l of this.lights) if (!name || l.name === name) l.light.intensity = l.base * gain;
  }

  /** `renderer` prefilters the probe (PMREM). */
  static async load(renderer: THREE.WebGLRenderer, base = "/lab/desk3d"): Promise<BakedDesk> {
    const meta = (await (await fetch(`${base}/desk.json`)).json()) as BakedDeskMeta;
    const tl = new THREE.TextureLoader();
    const tex = (file: string, color: boolean) =>
      tl.loadAsync(`${base}/${file}`).then((t) => {
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.flipY = false; // glTF UV convention
        t.anisotropy = 8;
        return t;
      });
    const [gltf, probe, lutBuf] = await Promise.all([
      new GLTFLoader().loadAsync(`${base}/desk.glb`),
      new EXRLoader().loadAsync(`${base}/${meta.probe}`),
      fetch(`${base}/${meta.lut}`).then((r) => r.arrayBuffer()),
    ]);
    // the LUT: [b][g][r] RGB bytes -> RGBA 3D texture (r along x)
    const rgb = new Uint8Array(lutBuf);
    const rgba = new Uint8Array(LUT_N * LUT_N * LUT_N * 4);
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      rgba[j] = rgb[i]; rgba[j + 1] = rgb[i + 1]; rgba[j + 2] = rgb[i + 2]; rgba[j + 3] = 255;
    }
    const lut = new THREE.Data3DTexture(rgba, LUT_N, LUT_N, LUT_N);
    lut.format = THREE.RGBAFormat;
    lut.type = THREE.UnsignedByteType;
    lut.minFilter = lut.magFilter = THREE.LinearFilter;
    lut.wrapS = lut.wrapT = lut.wrapR = THREE.ClampToEdgeWrapping;
    lut.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const prefilter = (t: THREE.DataTexture) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      const out = pmrem.fromEquirectangular(t).texture;
      t.dispose();
      return out;
    };
    const envMap = prefilter(probe);
    pmrem.dispose();

    const sanitize = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n);
    const metaByNode = new Map(Object.entries(meta.materials).map(([k, v]) => [sanitize(k), v]));
    const d = new BakedDesk();
    const pending: Promise<void>[] = [];
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = metaByNode.get(mesh.name) ?? metaByNode.get(mesh.parent?.name ?? "");
      if (!m) return;
      if (m.screen) {
        // the screen: the index, glowing at Blender's strength x the wake; a matte glass front
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0, 0, 0), roughness: 0.5, envMap,
          emissive: new THREE.Color(1, 1, 1), emissiveIntensity: m.emission ?? 1.1, toneMapped: false,
        });
        withBlenderView(mat, lut);
        withExactFresnel(mat, etaForLevel(0.02));   // Blender: black glass, Specular IOR Level 0.02
        const reveal = {
          uRevBox: { value: REVEAL.elements.map((e) => new THREE.Vector4(e.box[0], e.box[1], e.box[2], e.box[3])) },
          uRevAnim: { value: REVEAL.elements.map(() => new THREE.Vector3(0, 0, 0)) },
          uRevWake: { value: 1 },
          uRevBg: { value: new THREE.Color("#0a0a0b") },   // the index's --bg
        };
        withScreenReveal(mat, reveal);
        if (meta.screen) pending.push(tex(meta.screen, true).then((t) => { mat.emissiveMap = t; VIEW.uScrTex.value = t; mat.needsUpdate = true; }));
        d.screen = { material: mat, emission: m.emission ?? 1.1, reveal };
        (mesh.material as THREE.Material).dispose();
        mesh.material = mat;
        mesh.renderOrder = -100;
        return;
      }
      const metal = m.metallic > 0.5;
      let onLid = false;
      for (let p: THREE.Object3D | null = mesh.parent; p; p = p.parent) if (meta.lid && p.name === sanitize(meta.lid.pivot)) onLid = true;
      const mat = new THREE.MeshPhysicalMaterial({
        // the diffuse light is baked (emissive); live shading adds only reflection (black base for dielectrics)
        color: metal ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : new THREE.Color(0, 0, 0),
        metalness: m.metallic,
        roughness: m.roughness,
        ior: m.ior,
        // Blender's Specular IOR Level 0.5 = the IOR's own reflectance; lower levels: withExactFresnel
        specularIntensity: m.combined ? 0 : m.specular < 0.25 ? 1 : m.specular * 2,
        clearcoat: m.coat,
        clearcoatRoughness: m.coat_roughness,
        // the room without the lights; the lights' reflections come from the real lights (checked 2026-10-09 against
        // the settle, rise and descend plates: the shut lid within 10/255; the room with the lights in it counted the
        // lamp and the rim twice)
        envMap,
        envMapIntensity: m.combined ? 0 : 1,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: meta.encode,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const diffs = typeof m.diff === "string" ? { shut: m.diff } : m.diff;
      pending.push(
        (async () => {
          const [tShut, tOpen, tLit] = await Promise.all(
            [diffs.shut, diffs.open, diffs.lit].map((f) => (f ? tex(f, true) : Promise.resolve(undefined))),
          );
          // the keys, trackpad and bezel have no shut bake: the shut lid covers them, so they start dark and take their
          // light as the lid opens
          const dark = !tShut && (tOpen || tLit) ? BLACK : undefined;
          const base = tShut ?? dark ?? tOpen ?? tLit;
          mat.emissiveMap = base ?? null;
          if (tOpen || tLit) withBlenderView(mat, lut, tOpen ?? base, tLit ?? tOpen ?? base);
          else withBlenderView(mat, lut);
          if (meta.lid && !onLid) withLidOcclusion(mat);
          withBallShadow(mat);
          // low-reflectance glass (the bezel) where Schlick's curve fails; at Blender's default level (0.5, IOR 1.5)
          // Schlick fits the exact curve and three's split sum handles a rough lobe at grazing angles better
          if (!metal && !m.combined && m.specular < 0.25) withExactFresnel(mat, etaForLevel(m.specular, m.ior));
          if (m.rough) {
            mat.roughnessMap = await tex(m.rough, false);
            mat.roughness = 1; // the map carries it
          }
          if (m.normal) mat.normalMap = await tex(m.normal, false);
          mat.needsUpdate = true;
        })(),
      );
      d.materials.push(mat);
      (mesh.material as THREE.Material).dispose();
      mesh.material = mat;
      mesh.renderOrder = -100;
      mesh.onBeforeRender = (_r, _s, camera) => d.trackView(camera);
    });
    await Promise.all(pending);
    d.group.add(gltf.scene);
    const k = meta.chaos_scale;
    // the lights, in the GLB's frame (Blender metres, y up); the group's scale carries positions into the hero's units,
    // so a point-like light's intensity scales by 1/k^2 (distances grow by 1/k); an area light's radiance doesn't
    const toY = (v: number[]) => new THREE.Vector3(v[0], v[2], -v[1]);
    if (meta.lights) {
      RectAreaLightUniformsLib.init();
      for (const [name, L] of Object.entries(meta.lights)) {
        const color = new THREE.Color(L.color[0], L.color[1], L.color[2]);
        const pos = toY(L.pos), dir = toY(L.dir);
        if (L.type === "AREA") {
          const w = L.size ?? 0.2, h = L.shape === "RECTANGLE" ? (L.size_y ?? w) : w;
          const base = L.watts / (Math.PI * w * h); // radiance of a Lambertian emitter of this power and area
          // three sizes a rect light by its own width and height and the rotation of its world matrix, never the scale:
          // give it its size in the hero's units (the group's scale doesn't reach it)
          const light = new THREE.RectAreaLight(color, base, w / k, h / k);
          light.position.copy(pos);
          if (L.up) light.up.copy(toY(L.up));
          light.lookAt(pos.clone().add(dir));
          d.group.add(light);
          d.lights.push({ name, light, base, follows: L.follows });
        } else {
          const base = L.watts / (4 * Math.PI) / (k * k);
          const light = L.type === "SPOT"
            ? new THREE.SpotLight(color, base, 0, (L.spot_size ?? 1) / 2, L.blend ?? 0, 2)
            : new THREE.PointLight(color, base, 0, 2);
          light.position.copy(pos);
          if (light instanceof THREE.SpotLight) {
            light.target.position.copy(pos.clone().add(dir));
            d.group.add(light.target);
          }
          d.group.add(light);
          d.lights.push({ name, light, base, follows: L.follows });
        }
      }
    }
    if (meta.lid) {
      const pivot = gltf.scene.getObjectByName(sanitize(meta.lid.pivot));
      const shell = pivot?.getObjectByName("bake_lid") as THREE.Mesh | undefined;
      if (pivot && shell) {
        // the lid's mid-plane as a rectangle in the pivot's frame (the hinge's: the box is aligned with the lid)
        const box = new THREE.Box3(), v = new THREE.Vector3();
        const pos = shell.geometry.getAttribute("position");
        shell.updateMatrix();
        for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(shell.matrix));
        const size = box.getSize(new THREE.Vector3());
        const thin = size.x < size.y ? (size.x < size.z ? 0 : 2) : size.y < size.z ? 1 : 2;   // the thickness axis
        const [i1, i2] = [0, 1, 2].filter((a) => a !== thin);
        const mid = box.getCenter(new THREE.Vector3()).getComponent(thin);
        const corner = (a: number, b: number) => {
          const c = new THREE.Vector3().setComponent(thin, mid);
          c.setComponent(i1, a ? box.max.getComponent(i1) : box.min.getComponent(i1));
          c.setComponent(i2, b ? box.max.getComponent(i2) : box.min.getComponent(i2));
          return c;
        };
        d.lid = { pivot, q0: pivot.quaternion.clone(), bakedDeg: meta.lid.baked_open_deg, corners: [corner(0, 0), corner(1, 0), corner(0, 1)], screen: null };
        const disp = d.screen ? (pivot.getObjectByProperty("material", d.screen.material) as THREE.Mesh | undefined) : undefined;
        if (disp) {
          const scr = fitScreen(disp);
          // its front is the side away from the lid's middle (the stored normal may face either way)
          const toFront = scr[0].clone().add(scr[1]).add(scr[2]).multiplyScalar(1 / 3).sub(box.getCenter(new THREE.Vector3()));
          if (scr[3].dot(toFront) < 0) scr[3].negate();
          d.lid.screen = scr;
        }
      }
    }
    d.setLid(0);
    d.setState(0, 0);
    d.setScreen(null);
    const [cx, cy, cz] = meta.chaos_center; // Blender, z up
    d.group.scale.setScalar(1 / k);
    d.group.position.set(-cx / k, -cz / k, cy / k);
    return d;
  }

  /** Lab: draw what the lid blocks from each surface's reflection (red). */
  set debugLid(v: boolean | number) {
    VIEW.uLidDebug.value = typeof v === "number" ? v : v ? 1 : 0;
  }

  set envIntensity(v: number) {
    this.materials.forEach((m) => (m.envMapIntensity = v));
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      [mat.emissiveMap, mat.roughnessMap, mat.normalMap].forEach((t) => t?.dispose());
      mat.dispose();
    });
  }
}
