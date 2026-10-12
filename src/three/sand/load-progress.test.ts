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
