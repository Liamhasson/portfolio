// src/three/pendant/passes-shaders.test.ts
// The pendant patches three's BokehShader and OutputShader by text. These run the patches on the installed three (its passes
// build their materials without a GL context), so an upgrade that moves an anchor fails here.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, ShaderChunk, ShaderLib } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  BOKEH_BLUR, BOKEH_OPAQUE_ALPHA, BRDF_INCLUDE, BRDF_LUT, ENV_BEND, ENV_INCLUDE, LIGHTS_INCLUDE, LIGHTS_LUT, LIGHTS_MS, OUTPUT_READ,
  patchBokeh, patchOutput, patchShadingR170,
} from "./passes";

describe("three's shaders still hold the pendant's patch anchors", () => {
  it("BokehPass: the alpha line and the blur radius line exist, once each", () => {
    const frag = new BokehPass(new Scene(), new PerspectiveCamera(), { focus: 1 }).materialBokeh.fragmentShader;
    expect(frag.split(BOKEH_OPAQUE_ALPHA).length - 1).toBe(1);
    expect(frag.split(BOKEH_BLUR).length - 1).toBe(1);
    const patched = patchBokeh(frag);
    expect(patched).not.toContain(BOKEH_OPAQUE_ALPHA);
    expect(patched).toContain("smoothstep( 0.0, 0.5, texture2D( tColor, vUv ).a )");
  });

  it("OutputPass: the read line exists, once, and the patch un-premultiplies then premultiplies", () => {
    const frag = new OutputPass().material.fragmentShader;
    expect(frag.split(OUTPUT_READ).length - 1).toBe(1);
    const patched = patchOutput(frag);
    expect(patched.indexOf("rgb /= max")).toBeGreaterThan(patched.indexOf(OUTPUT_READ));
    expect(patched.lastIndexOf("gl_FragColor.rgb *= gl_FragColor.a;")).toBeGreaterThan(patched.indexOf("rgb /= max"));
    expect(patched.trimEnd().endsWith("}")).toBe(true);
  });

  it("the patches throw, naming the file, when an anchor is missing", () => {
    expect(() => patchBokeh("void main() {}")).toThrow(/passes\.ts/);
    expect(() => patchOutput("void main() {}")).toThrow(/passes\.ts/);
  });

  it("MeshStandardMaterial: the r170 shading patch finds its three includes and its four anchors, and replaces each", () => {
    const frag = ShaderLib.standard.fragmentShader; // (what onBeforeCompile hands the brass: includes not yet resolved)
    for (const inc of [ENV_INCLUDE, BRDF_INCLUDE, LIGHTS_INCLUDE]) expect(frag.split(inc).length - 1).toBe(1);
    expect(ShaderChunk.envmap_physical_pars_fragment.split(ENV_BEND).length - 1).toBe(1);
    expect(ShaderChunk.lights_physical_pars_fragment.split(BRDF_LUT).length - 1).toBe(1);
    expect(ShaderChunk.lights_fragment_begin.split(LIGHTS_LUT).length - 1).toBe(1);
    expect(ShaderChunk.lights_fragment_begin.split(LIGHTS_MS).length - 1).toBe(1);
    const patched = patchShadingR170(frag, ShaderChunk);
    for (const gone of [ENV_INCLUDE, BRDF_INCLUDE, LIGHTS_INCLUDE, ENV_BEND, BRDF_LUT, LIGHTS_LUT, LIGHTS_MS]) {
      expect(patched).not.toContain(gone);
    }
    expect(patched).toContain("mix( reflectVec, normal, roughness * roughness )");
    expect(patched).toContain("material.multiScatteringCompensation = vec3( 1.0 );");
    // the fit is declared before its first use (EnvironmentBRDF, then the lights)
    expect(patched.indexOf("vec2 dfgApproxR170(")).toBeLessThan(patched.indexOf("dfgApproxR170( dotNV, roughness )"));
    expect(patched.indexOf("dfgApproxR170( dotNV, roughness )")).toBeLessThan(patched.indexOf("dfgApproxR170( dotNVms, material.roughness )"));
    // three's own chunks are left alone (the patch is the brass's only)
    expect(ShaderChunk.envmap_physical_pars_fragment).toContain(ENV_BEND);
  });

  it("the r170 shading patch throws, naming the file, when an anchor is missing", () => {
    expect(() => patchShadingR170("void main() {}", ShaderChunk)).toThrow(/passes\.ts/);
    expect(() => patchShadingR170(ShaderLib.standard.fragmentShader, { ...ShaderChunk, lights_fragment_begin: "" })).toThrow(/passes\.ts/);
  });

  it("RoomEnvironment still moves itself down (scene.ts puts it back to r170's place)", () => {
    expect(new RoomEnvironment().position.y).toBe(-3.5);
  });
});
