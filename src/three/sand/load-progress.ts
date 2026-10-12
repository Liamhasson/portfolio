// src/three/sand/load-progress.ts
/**
 * The loader's progress (spec 2026-10-12-loader-design.md §4): the hero's files by their bytes (90%), then the first
 * frames compiled and warm (10%). Monotonic: a file declared late never sends it backwards.
 */
export class LoadProgress {
  private readonly total = new Map<string, number>();
  private readonly got = new Map<string, number>();
  private compiled = 0;
  private shown = 0;
  constructor(private readonly onChange?: (p: number) => void) {}

  expect(id: string, bytes: number): void { this.total.set(id, Math.max(bytes, 1)); if (!this.got.has(id)) this.got.set(id, 0); this.emit(); }
  add(id: string, bytes: number): void { this.got.set(id, (this.got.get(id) ?? 0) + bytes); this.emit(); }
  done(id: string): void { const t = this.total.get(id) ?? Math.max(this.got.get(id) ?? 1, 1); this.total.set(id, t); this.got.set(id, t); this.emit(); }
  compile(f: number): void { this.compiled = Math.min(Math.max(f, this.compiled), 1); this.emit(); }

  get value(): number { return this.shown; }

  private emit(): void {
    let t = 0, g = 0;
    for (const [id, n] of this.total) { t += n; g += Math.min(this.got.get(id) ?? 0, n); }
    const raw = (t > 0 ? 0.9 * (g / t) : 0) + 0.1 * this.compiled;
    const next = Math.max(this.shown, Math.min(raw, 1));
    if (next !== this.shown) { this.shown = next; this.onChange?.(next); }
  }
}

/** fetch, counting the body as it streams; the returned Response's body is already read (a buffered copy). */
export async function fetchTracked(url: string, id: string, progress: LoadProgress | null): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`loader: ${url} ${res.status}`);
  const len = Number(res.headers.get("Content-Length")) || 0;
  if (progress) progress.expect(id, len || 1);
  if (!res.body || !progress) { const buf = await res.arrayBuffer(); progress?.done(id); return new Response(buf, { headers: res.headers }); }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); n += value.byteLength;
    progress.add(id, value.byteLength);
  }
  progress.done(id);
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return new Response(out, { headers: res.headers });
}
