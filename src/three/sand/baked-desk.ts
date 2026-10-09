import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

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
  diff: string;
  rough?: string;
  normal?: string;
  /** All its light is baked (paper: translucency); no live reflection. */
  combined?: boolean;
}

interface LightMeta {
  type: "SPOT" | "AREA" | "POINT";
  pos: number[];
  dir: number[];
  watts: number;
  color: number[];
  radius: number;
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
  /** The room with the lights' own soft discs in it: what the metal and the coated pen reflect. */
  probe_lit?: string;
  lut: string;
  chaos_center: [number, number, number];
  chaos_scale: number;
  /** The set's lights: close to the desk, so their reflections are drawn by real lights (only reflections: the
   *  dielectrics' base colour is black and their diffuse is baked). */
  lights?: Record<string, LightMeta>;
}

const LUT_N = 64;
const LUT_MIN = -12.47393; // log2(2^-10 * 0.18)
const LUT_MAX = 4.026069; // log2(2^6.5 * 0.18)

/** Replaces three's tone mapping and colour-space output with Blender's view transform (scene-linear in, display out). */
function withBlenderView(material: THREE.Material, lut: THREE.Data3DTexture): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLut = { value: lut };
    shader.fragmentShader =
      "uniform highp sampler3D uLut;\n" +
      shader.fragmentShader
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

export class BakedDesk {
  readonly group = new THREE.Group();
  readonly materials: THREE.MeshPhysicalMaterial[] = [];
  readonly lights: { name: string; light: THREE.SpotLight | THREE.RectAreaLight | THREE.PointLight; base: number }[] = [];

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
    const [gltf, probe, probeLit, lutBuf] = await Promise.all([
      new GLTFLoader().loadAsync(`${base}/desk.glb`),
      new EXRLoader().loadAsync(`${base}/${meta.probe}`),
      meta.probe_lit ? new EXRLoader().loadAsync(`${base}/${meta.probe_lit}`) : Promise.resolve(null),
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
    const envLit = probeLit ? prefilter(probeLit) : envMap;
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
      const metal = m.metallic > 0.5;
      const mat = new THREE.MeshPhysicalMaterial({
        // the diffuse light is baked (emissive); live shading adds only reflection (black base for dielectrics)
        color: metal ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : new THREE.Color(0, 0, 0),
        metalness: m.metallic,
        roughness: m.roughness,
        ior: m.ior,
        specularIntensity: m.combined ? 0 : m.specular * 2, // Blender's Specular IOR Level 0.5 = the IOR's own reflectance
        clearcoat: m.coat,
        clearcoatRoughness: m.coat_roughness,
        envMap: metal || m.coat > 0 ? envLit : envMap,
        // fitted against the plate at the settle's end (2026-10-09): physical values hold for wood and paper (within 2%
        // near, 16% at the far edge); the metal reads 30% dark at x1 (the lamp's soft disc), x1.4 matches
        envMapIntensity: m.combined ? 0 : metal || m.coat > 0 ? 1.4 : 1,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: meta.encode,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      withBlenderView(mat, lut);
      pending.push(
        (async () => {
          mat.emissiveMap = await tex(m.diff, true);
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
          const light = new THREE.RectAreaLight(color, base, w, h);
          light.position.copy(pos);
          if (L.up) light.up.copy(toY(L.up));
          light.lookAt(pos.clone().add(dir));
          d.group.add(light);
          d.lights.push({ name, light, base });
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
          d.lights.push({ name, light, base });
        }
      }
    }
    const [cx, cy, cz] = meta.chaos_center; // Blender, z up
    d.group.scale.setScalar(1 / k);
    d.group.position.set(-cx / k, -cz / k, cy / k);
    return d;
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
