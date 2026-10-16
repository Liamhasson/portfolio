import { describe, expect, test } from "vitest";
import { PerspectiveCamera, Scene, type WebGLRenderTarget } from "three";
import { BOKEH_REACH, COMBINE_FRAGMENT, HALF_FROM_PX, SMALL_RING, ScaledBokehPass } from "./bokeh";

const internals = (p: ScaledBokehPass) => p as unknown as { _renderTargetDepth: WebGLRenderTarget; half: WebGLRenderTarget };

describe("ScaledBokehPass (the governor's half-resolution depth of field)", () => {
  test("at 0.5 the gather's target is half the composer's size (the depth pass stays full: exact blur per pixel)", () => {
    const p = new ScaledBokehPass(new Scene(), new PerspectiveCamera(), { focus: 3 });
    p.setSize(2880, 1800);
    expect(internals(p).half.width).toBe(1); // (unused at full scale)
    p.setScale(0.5);
    expect(p.bokehScale).toBe(0.5);
    expect(internals(p).half.width).toBe(1440);
    expect(internals(p).half.height).toBe(900);
    expect(internals(p)._renderTargetDepth.width).toBe(2880);
    // a resize from the composer keeps the scale
    p.setSize(2000, 1000);
    expect(internals(p).half.width).toBe(1000);
    expect(p.materialBokeh.uniforms.aspect.value).toBeCloseTo(2, 5);
    p.setScale(1);
    expect(internals(p).half.width).toBe(1);
    p.dispose();
  });

  test("the combine draws a sub-pixel blur itself at full resolution, a wider one from the half target, premultiplied throughout", () => {
    expect(COMBINE_FRAGMENT).toContain("smoothstep( 0.0, 0.5, c.a )"); // (the patched bokeh's own no-blur-where-empty rule)
    expect(COMBINE_FRAGMENT).toContain(`smoothstep( ${HALF_FROM_PX}`);
    expect(COMBINE_FRAGMENT).toContain(`* ${BOKEH_REACH} * width`);
    expect(COMBINE_FRAGMENT).toContain("mix( small, texture2D( tHalf, vUv ), k ) : small");
    expect(COMBINE_FRAGMENT).toContain("small = sum / 9.0;");
  });

  test("the small blur's ring spreads as BokehShader's 41 taps do (equal mean square radius)", () => {
    const rings = [[1, 0], [16, 1], [8, 0.9], [8, 0.7], [8, 0.4]];
    const msr = rings.reduce((a, [n, r]) => a + n * r * r, 0) / 41;
    expect((8 * SMALL_RING ** 2) / 9).toBeCloseTo(msr, 2);
  });
});
