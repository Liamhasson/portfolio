// src/three/pendant/passes-shaders.test.ts
// The pendant patches three's BokehShader and OutputShader by text. These run the patches on the installed three (its passes
// build their materials without a GL context), so an upgrade that moves an anchor fails here.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene } from "three";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BOKEH_BLUR, BOKEH_OPAQUE_ALPHA, OUTPUT_READ, patchBokeh, patchOutput } from "./passes";

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
});
