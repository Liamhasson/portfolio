// src/three/sand/load-progress.test.ts
import { describe, expect, test, vi } from "vitest";
import { LoadProgress, fetchTracked } from "./load-progress";

describe("the loader's progress (spec §4): bytes 90%, the compile 10%, never backwards", () => {
  test("weighted by bytes, the compile last", () => {
    const p = new LoadProgress();
    p.expect("a", 300); p.expect("b", 100);
    expect(p.value).toBe(0);
    p.add("a", 150);
    expect(p.value).toBeCloseTo(0.9 * 150 / 400, 6);
    p.done("a"); p.done("b");
    expect(p.value).toBeCloseTo(0.9, 6);
    p.compile(0.5);
    expect(p.value).toBeCloseTo(0.95, 6);
    p.compile(1);
    expect(p.value).toBe(1);
  });
  test("a file declared late never sends it backwards", () => {
    const seen: number[] = [];
    const p = new LoadProgress((v) => seen.push(v));
    p.expect("a", 100); p.done("a");
    p.expect("b", 900);
    expect(p.value).toBeGreaterThanOrEqual(0.9 * 100 / 100 - 1e-9);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });
  test("fetchTracked counts a streamed body and declares its size from Content-Length", async () => {
    const body = new Uint8Array(1000);
    const stream = new ReadableStream({ start(c) { c.enqueue(body.subarray(0, 400)); c.enqueue(body.subarray(400)); c.close(); } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { headers: { "Content-Length": "1000" } })));
    const p = new LoadProgress();
    const res = await fetchTracked("/x.bin", "x", p);
    expect((await res.arrayBuffer()).byteLength).toBe(1000);
    expect(p.value).toBeCloseTo(0.9, 6);
    vi.unstubAllGlobals();
  });
  test("a failed fetch rejects (the page falls back and unlocks)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(fetchTracked("/missing.bin", "m", new LoadProgress())).rejects.toThrow(/404/);
    vi.unstubAllGlobals();
  });
});

describe("honest from the first byte (final review I1: it latched at 90% when sand.json arrived, then froze)", () => {
  test("declared sizes hold when a response has no Content-Length, so a small first file is a small step", async () => {
    const p = new LoadProgress();
    p.expect("small", 100); p.expect("big", 9900);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(100))));   // (no Content-Length: compressed)
    await fetchTracked("/small", "small", p);
    vi.unstubAllGlobals();
    expect(p.value).toBeCloseTo(0.9 * 100 / 10000, 6);
  });
  test("the sand's files are declared at their real sizes before any byte arrives", async () => {
    const { sandFiles } = await import("./data");
    const meta = { parts: [{ file: "sand_0.bin", start: 0, count: 60000 }, { file: "sand_1.bin", start: 60000, count: 100000 }, { file: "sand_2.bin", start: 160000, count: 240000 }], volume: { res: [64, 48, 64] } };
    const files = sandFiles(meta as never, 160000);
    expect(files).toEqual([
      ["vol_chaos.bin", 64 * 48 * 64], ["vol_mid.bin", 64 * 48 * 64], ["vol_ball.bin", 64 * 48 * 64],
      ["sand_0.bin", 60000 * 12], ["sand_1.bin", 100000 * 12],
    ]);
  });
});

test("the bytes received keep counting while the shown progress holds (a file declared late): a stall check watches these (final review #5)", () => {
  const p = new LoadProgress();
  p.expect("a", 100); p.add("a", 90);
  const shown = p.value;
  p.expect("b", 10_000); p.add("b", 50);
  expect(p.value).toBe(shown);
  expect(p.received).toBe(140);
});
