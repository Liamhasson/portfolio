import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BRIEF } from "@/app/lab/sand/brief-geometry";
import { BuildFrame, FRAME, frameGeometry, frameParts } from "./build-frame";
import { getFrameState, resetFrameForTests, setFrameState, type FrameState } from "./build-frame-state";

// the build stage at 1440 x 900 (mockup i): 518 x 445, centred on the locked pendant
const CX = 980, CY = 452, W = 518, H = 445;
const st = (o: Partial<FrameState>): FrameState => ({ phase: "build", cx: CX, cy: CY, w: W, h: H, grow: 1, retract: 0, ...o });

let reduced = false;
beforeEach(() => {
  reduced = false;
  window.matchMedia = vi.fn().mockImplementation(() => ({ get matches() { return reduced; }, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => { resetFrameForTests(); delete window.__frame; window.history.replaceState(null, "", "/"); });

const num = (el: Element, a: string) => Number(el.getAttribute(a));
const all = (sel: string) => [...document.querySelectorAll(`[data-frame='${sel}']`)];
const one = (sel: string) => document.querySelector(`[data-frame='${sel}']`)!;
const frame = () => document.querySelector<SVGSVGElement>("svg.ab-frame")!;
const dash = (el: Element) => el.getAttribute("stroke-dasharray")!.split(" ").map(Number);

describe("the drawing (pure)", () => {
  test("full: the box is the frame's size, centred on the pendant, with the loader's corner construction", () => {
    const f = frameGeometry(st({}), false);
    expect(f.visible).toBe(true);
    expect(f.box).toEqual({ x0: CX - W / 2, y0: CY - H / 2, x1: CX + W / 2, y1: CY + H / 2, r: FRAME.radius });
    // every pair of opposite things mirrors about the centre
    expect((f.box.x0 + f.box.x1) / 2).toBe(CX);
    expect((f.box.y0 + f.box.y1) / 2).toBe(CY);
    // the ends sit one radius in from each corner, the handles point at their corner, 0.5523 x the radius long
    expect(f.ends[0]).toEqual([CX - W / 2 + 18, CY - H / 2]);
    expect(f.ends[7]).toEqual([CX - W / 2, CY - H / 2 + 18]);
    for (const [x1, y1, x2, y2] of f.handles) expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(BRIEF.handle * 18, 6);
    expect(f.handles[0][2]).toBeLessThan(f.handles[0][0]);   // TL.top's handle runs left, toward TL
    // 13 anchors: the centre, the 8 ends, the 4 corners
    expect(f.anchors).toHaveLength(13);
    expect(f.anchors[0]).toEqual([CX, CY]);
    expect(f.anchors.slice(9)).toEqual([[f.box.x0, f.box.y0], [f.box.x1, f.box.y0], [f.box.x1, f.box.y1], [f.box.x0, f.box.y1]]);
    // the edges whole: no gap in the middle
    for (const e of f.edges) expect(Number(e.dash.split(" ")[1])).toBe(0);
  });

  test("the centre guides stay within the frame plus 16 px", () => {
    const f = frameGeometry(st({}), false);
    expect(f.guides.h).toEqual([CX - W / 2 - 16, CY, CX + W / 2 + 16, CY]);
    expect(f.guides.v).toEqual([CX, CY - H / 2 - 16, CX, CY + H / 2 + 16]);
    expect(f.guides.alpha).toBeCloseTo(BRIEF.guide, 6);
  });

  test("nothing drawn before the grow: no phase, the flight, the snap", () => {
    for (const phase of [null, "flight", "snap"] as const) expect(frameGeometry(st({ phase, grow: 0 }), false).visible).toBe(false);
    expect(frameGeometry(st({ w: 0, h: 0 }), false).visible).toBe(false);
  });

  test("the grow: it starts tight round the pendant and opens out, the corners leading the lines", () => {
    const g0 = frameGeometry(st({ phase: "grow", grow: 0 }), false);
    expect(g0.box.x1 - g0.box.x0).toBeCloseTo(W * FRAME.tight.w, 6);
    expect(g0.box.y1 - g0.box.y0).toBeCloseTo(H * FRAME.tight.h, 6);
    expect(g0.parts.lines).toBe(0);
    const sizes = [0.1, 0.25, 0.5, 0.75, 1].map((g) => frameParts({ phase: "grow", grow: g, retract: 0 }, false));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i].size).toBeGreaterThan(sizes[i - 1].size);
      expect(sizes[i].lines).toBeGreaterThanOrEqual(sizes[i - 1].lines);
    }
    // the corners lead: at every moment of the grow they are further along than the lines
    for (const p of sizes.slice(0, -1)) expect(p.size).toBeGreaterThan(p.lines);
    expect(sizes[4]).toEqual({ size: 1, lines: 1, handles: 1 });
  });

  test("at grow 0.5: the box part-way open, every edge drawn from both its ends toward the middle", () => {
    const f = frameGeometry(st({ phase: "grow", grow: 0.5 }), false);
    const p = f.parts;
    expect(p.size).toBeCloseTo(0.875, 6);   // (eased out: 1 - 0.5^3)
    const bw = W * (FRAME.tight.w + (1 - FRAME.tight.w) * p.size), bh = H * (FRAME.tight.h + (1 - FRAME.tight.h) * p.size);
    expect(f.box.x1 - f.box.x0).toBeCloseTo(bw, 6);
    expect(f.box.y1 - f.box.y0).toBeCloseTo(bh, 6);
    expect((f.box.x0 + f.box.x1) / 2).toBeCloseTo(CX, 6);
    expect((f.box.y0 + f.box.y1) / 2).toBeCloseTo(CY, 6);
    expect(p.lines).toBeGreaterThan(0.2);
    expect(p.lines).toBeLessThan(0.5);
    const lens = [bw - 36, bh - 36, bw - 36, bh - 36];
    f.edges.forEach((e, i) => {
      const [d, gap, d2] = e.dash.split(" ").map(Number);
      expect(d).toBeCloseTo((p.lines * lens[i]) / 2, 1);
      expect(d2).toBe(d);
      expect(d + gap + d2).toBeCloseTo(lens[i], 1);
      expect(e.drawn).toBeCloseTo(p.lines * lens[i], 6);
    });
    // the guides grow with the box and the lines
    expect(f.guides.h[0]).toBeCloseTo(f.box.x0 - 16, 6);
    expect(f.guides.alpha).toBeCloseTo(BRIEF.guide * p.lines, 6);
  });

  test("the retract: the lines pull back into the corners, then the handles fade", () => {
    const at = (r: number) => frameGeometry(st({ phase: "retract", retract: r }), false);
    const half = at(0.5);
    expect(half.box).toEqual(at(0).box);   // the frame holds its size
    expect(half.parts.lines).toBeGreaterThan(0);
    expect(half.parts.lines).toBeLessThan(0.5);
    expect(half.parts.handles).toBe(1);
    // what is left of each edge sits at its two corner ends: dash at each end, the gap in the middle
    for (const e of half.edges) {
      const [d, gap] = e.dash.split(" ").map(Number);
      expect(d).toBeGreaterThan(0);
      expect(gap).toBeGreaterThan(d);
    }
    const r = [0, 0.2, 0.4, 0.6, 0.7, 0.85, 1].map(at);
    for (let i = 1; i < r.length; i++) expect(r[i].parts.lines).toBeLessThanOrEqual(r[i - 1].parts.lines);
    expect(at(FRAME.linesGone).parts.lines).toBe(0);
    expect(at(0.85).parts.handles).toBeGreaterThan(0);
    expect(at(0.85).parts.handles).toBeLessThan(1);
    expect(at(1).visible).toBe(false);
  });

  test("reduced motion: whole at once, no grow", () => {
    for (const g of [0, 0.3]) expect(frameGeometry(st({ phase: "grow", grow: g }), true).parts).toEqual({ size: 1, lines: 1, handles: 1 });
    // (the retract is scrolled, so it stays)
    expect(frameGeometry(st({ phase: "retract", retract: 0.5 }), true).parts.lines).toBeLessThan(0.5);
  });
});

describe("the SVG", () => {
  test("hidden from assistive tech, never takes the pointer or the focus, hidden until there is a frame", () => {
    render(<BuildFrame />);
    const el = frame();
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("focusable", "false");
    expect(el.querySelectorAll("[tabindex], a, button")).toHaveLength(0);
    expect(el.style.visibility).toBe("hidden");
    expect(el.dataset.phase).toBe("none");
  });

  test("full: the box, the corner handles and the anchors drawn round the centre", () => {
    render(<BuildFrame />);
    act(() => setFrameState(st({})));
    const el = frame();
    expect(el.style.visibility).toBe("");
    expect(el.dataset.phase).toBe("build");
    const [top, right, bottom, left] = all("box");
    expect([num(top, "x1"), num(top, "y1"), num(top, "x2"), num(top, "y2")]).toEqual([CX - W / 2, CY - H / 2, CX + W / 2, CY - H / 2]);
    expect(num(right, "x1")).toBe(CX + W / 2);
    expect(num(bottom, "y1")).toBe(CY + H / 2);
    expect(num(left, "x1")).toBe(CX - W / 2);
    expect(dash(top)[1]).toBe(0);
    // the handle squares: 5 px, centred on their points (the last four on the box's corners)
    const anchors = all("anchor");
    expect(anchors).toHaveLength(13);
    expect(num(anchors[0], "x") + 2.5).toBe(CX);
    expect(num(anchors[0], "y") + 2.5).toBe(CY);
    expect(num(anchors[9], "x") + 2.5).toBe(CX - W / 2);
    expect(num(anchors[11], "y") + 2.5).toBe(CY + H / 2);
    expect(num(anchors[3], "width")).toBe(BRIEF.square);
    // the eight dots at the handles' tips, the arcs a path of four curves
    expect(all("end")).toHaveLength(8);
    expect(one("arc").getAttribute("d")!.match(/C/g)).toHaveLength(4);
    // the guides: dashed, within the frame + 16
    expect(one("gh").getAttribute("stroke-dasharray")).toBe("2 4");
    expect(num(one("gh"), "x1")).toBe(CX - W / 2 - 16);
    expect(num(one("gv"), "y2")).toBe(CY + H / 2 + 16);
  });

  test("the loader's line language: its colour, hairlines and opacities, no glow, no fill", () => {
    render(<BuildFrame />);
    act(() => setFrameState(st({})));
    const el = frame();
    expect(el.getAttribute("stroke")).toBe(`rgb(${BRIEF.rgb})`);
    expect(el.getAttribute("stroke-width")).toBe("1");
    expect(el.getAttribute("fill")).toBe("none");
    expect(el.innerHTML).not.toMatch(/filter|blur|shadow|gradient/i);
    expect(all("box")[0].getAttribute("stroke-width")).toBe("0.7");
    expect(num(all("box")[0], "opacity")).toBe(0.5);
    expect(all("edge")[0].getAttribute("stroke-opacity")).toBe("0.85");
    expect(num(all("handle")[0], "opacity")).toBe(0.6);
    expect(num(all("end")[0], "opacity")).toBe(0.8);
    expect(all("anchor")[0].getAttribute("fill")).toBe("#0b0908");
    expect(num(one("gh"), "opacity")).toBe(BRIEF.guide);
  });

  test("the store driven through the whole sequence: null, grow 0..1, build, retract 0..1, null", () => {
    render(<BuildFrame />);
    const el = frame();
    const width = () => num(all("box")[0], "x2") - num(all("box")[0], "x1");
    act(() => setFrameState(st({ phase: "snap", grow: 0 })));
    expect(el.style.visibility).toBe("hidden");
    const widths: number[] = [], drawn: number[] = [];
    for (const g of [0.05, 0.25, 0.5, 0.75, 1]) {
      act(() => setFrameState(st({ phase: "grow", grow: g })));
      expect(el.style.visibility).toBe("");
      widths.push(width());
      drawn.push(dash(all("edge")[0])[0]);
    }
    for (let i = 1; i < widths.length; i++) { expect(widths[i]).toBeGreaterThan(widths[i - 1]); expect(drawn[i]).toBeGreaterThanOrEqual(drawn[i - 1]); }
    expect(widths[4]).toBe(W);
    act(() => setFrameState(st({ phase: "build" })));
    expect(width()).toBe(W);
    const left: number[] = [];
    for (const r of [0, 0.25, 0.5, 0.75]) {
      act(() => setFrameState(st({ phase: "retract", retract: r })));
      expect(width()).toBe(W);
      left.push(dash(all("edge")[0])[0]);
    }
    for (let i = 1; i < left.length; i++) expect(left[i]).toBeLessThanOrEqual(left[i - 1]);
    expect(left[3]).toBe(0);
    expect(all("edge")[0].getAttribute("opacity")).toBe("0");
    // the corner handles still there, fading
    expect(num(all("handle")[0], "opacity")).toBeGreaterThan(0);
    expect(num(all("handle")[0], "opacity")).toBeLessThan(0.6);
    act(() => setFrameState(st({ phase: "retract", retract: 1 })));
    expect(el.style.visibility).toBe("hidden");
    act(() => setFrameState(st({ phase: null, grow: 0 })));
    expect(el.style.visibility).toBe("hidden");
    expect(el.dataset.phase).toBe("none");
  });

  test("scrolling back past the snap un-grows it", () => {
    render(<BuildFrame />);
    const width = () => num(all("box")[0], "x2") - num(all("box")[0], "x1");
    act(() => setFrameState(st({ phase: "build" })));
    act(() => setFrameState(st({ phase: "grow", grow: 0.5 })));
    const mid = width();
    act(() => setFrameState(st({ phase: "grow", grow: 0.1 })));
    expect(width()).toBeLessThan(mid);
    act(() => setFrameState(st({ phase: "snap", grow: 0 })));
    expect(frame().style.visibility).toBe("hidden");
  });

  test("it follows the pendant and the screen: a new centre or size moves and resizes it", () => {
    render(<BuildFrame />);
    act(() => setFrameState(st({})));
    act(() => setFrameState(st({ cx: 640, cy: 400, w: 400, h: 340 })));
    const [top, right] = all("box");
    expect([num(top, "x1"), num(top, "y1"), num(top, "x2")]).toEqual([440, 230, 840]);
    expect(num(right, "y2")).toBe(570);
    expect(num(all("anchor")[0], "x") + 2.5).toBe(640);
    expect(num(one("gh"), "x2")).toBe(856);
  });

  test("reduced motion: the grow shows the whole frame at once", () => {
    reduced = true;
    render(<BuildFrame />);
    act(() => setFrameState(st({ phase: "grow", grow: 0.05 })));
    expect(num(all("box")[0], "x2") - num(all("box")[0], "x1")).toBe(W);
    expect(dash(all("edge")[0])[1]).toBe(0);
  });

  test("?pendant-debug: window.__frame sets the state (headless stills before the mount writes it); never without it", () => {
    const { unmount } = render(<BuildFrame />);
    expect(window.__frame).toBeUndefined();
    unmount();
    window.history.replaceState(null, "", "/about?pendant-debug");
    const r = render(<BuildFrame />);
    expect(window.__frame).toBeDefined();
    act(() => window.__frame!.set(st({ phase: "grow", grow: 0.6 })));
    expect(frame().dataset.phase).toBe("grow");
    expect(window.__frame!.get().grow).toBe(0.6);
    r.unmount();
    expect(window.__frame).toBeUndefined();
  });

  test("unmounted mid-build, it clears the store: a visit back opens with no frame until the pendant writes again", () => {
    const first = render(<BuildFrame />);
    act(() => setFrameState(st({ phase: "build" })));
    expect(frame().style.visibility).toBe("");
    first.unmount();
    expect(getFrameState().phase).toBeNull();
    expect(getFrameState().w).toBe(0);
    // back on About: the frame stays hidden over the opening
    render(<BuildFrame />);
    expect(frame().style.visibility).toBe("hidden");
    expect(frame().dataset.phase).toBe("none");
    // and the next write draws it again
    act(() => setFrameState(st({ phase: "build" })));
    expect(frame().style.visibility).toBe("");
  });

  test("the phase attribute is written only when it changes", () => {
    render(<BuildFrame />);
    const el = frame();
    act(() => setFrameState(st({ phase: "grow", grow: 0.3 })));
    const mo = new MutationObserver(() => {});
    mo.observe(el, { attributes: true, attributeFilter: ["data-phase"] });
    act(() => setFrameState(st({ phase: "grow", grow: 0.4 })));
    act(() => setFrameState(st({ phase: "grow", grow: 0.5 })));
    expect(mo.takeRecords()).toHaveLength(0);
    act(() => setFrameState(st({ phase: "build" })));
    expect(mo.takeRecords()).toHaveLength(1);
    expect(el.dataset.phase).toBe("build");
    mo.disconnect();
  });
});
