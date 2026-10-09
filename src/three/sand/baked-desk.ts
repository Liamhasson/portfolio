import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";

/**
 * The desk as a real 3D object (lookdev.py --scene bakedesk): every surface carries its Cycles lighting baked into its
 * texture (radiance / encode, sRGB), so it is drawn unlit (texture x encode, then AgX) and any camera move is free.
 * Placed in the hero's units like the plates: hero = (desk - chaos_center) / chaos_scale (the GLB is already y-up).
 */
const VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uMap;
uniform float uEncode;
uniform float uExposure;
void main() {
  vec3 c = texture(uMap, vUv).rgb * uEncode * uExposure;   // the sRGB texture is decoded to linear by the GPU
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface BakedDeskMeta {
  encode: number;
  /** The textures already went through Blender's view transform (AgX Punchy): draw them as-is, no tone mapping. */
  display_referred?: boolean;
  chaos_center: [number, number, number];
  chaos_scale: number;
  /** Metal and the coated pen: their diffuse is baked (linear / glossy_encode); reflections are drawn live from the probe. */
  glossy?: Record<string, { color: number[]; metallic: number; roughness: number; coat: number; coat_roughness: number } | null>;
  glossy_encode?: number;
  probe?: string;
}

export class BakedDesk {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  readonly glossyMaterials: THREE.MeshPhysicalMaterial[] = [];

  private constructor() {}

  /** `renderer` builds the probe's prefiltered reflections (PMREM). */
  static async load(renderer: THREE.WebGLRenderer, base = "/lab/desk3d"): Promise<BakedDesk> {
    const meta = (await (await fetch(`${base}/desk.json`)).json()) as BakedDeskMeta;
    const [gltf, probe] = await Promise.all([
      new GLTFLoader().loadAsync(`${base}/desk.glb`),
      meta.probe ? new EXRLoader().loadAsync(`${base}/${meta.probe}`) : Promise.resolve(null),
    ]);
    let envMap: THREE.Texture | null = null;
    if (probe) {
      probe.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      envMap = pmrem.fromEquirectangular(probe).texture;
      pmrem.dispose();
      probe.dispose();
    }
    const sanitize = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n);
    const glossy = new Map(Object.entries(meta.glossy ?? {}).map(([k, v]) => [sanitize(k), v]));
    const d = new BakedDesk();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      const map = src.map;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 8;
      }
      const g = glossy.get(mesh.name) ?? glossy.get(mesh.parent?.name ?? "");
      if (g && envMap) {
        // live reflections of the room (the probe), plus its baked diffuse light
        const pm = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(g.color[0], g.color[1], g.color[2]),
          metalness: g.metallic,
          roughness: g.roughness,
          clearcoat: g.coat,
          clearcoatRoughness: g.coat_roughness,
          envMap,
          emissiveMap: map,
          emissive: new THREE.Color(1, 1, 1),
          emissiveIntensity: meta.glossy_encode ?? 4,
          // fitted against the plate's lid at settle frame 48: the probe's pattern matches (r 0.97), its strength x0.74
          envMapIntensity: 0.74,
        });
        d.glossyMaterials.push(pm);
        mesh.material = pm;
        mesh.renderOrder = -100;
        src.dispose();
        return;
      }
      const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: THREE.DoubleSide,
        toneMapped: !meta.display_referred,
        uniforms: { uMap: { value: map }, uEncode: { value: meta.encode }, uExposure: { value: 1 } },
      });
      d.materials.push(m);
      mesh.material = m;
      mesh.renderOrder = -100;
      src.dispose();
    });
    d.group.add(gltf.scene);
    const k = meta.chaos_scale;
    const [cx, cy, cz] = meta.chaos_center;   // Blender, z up
    d.group.scale.setScalar(1 / k);
    d.group.position.set(-cx / k, -cz / k, cy / k);
    return d;
  }

  set exposure(v: number) {
    this.materials.forEach((m) => (m.uniforms.uExposure.value = v));
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.ShaderMaterial).uniforms.uMap.value?.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
  }
}
