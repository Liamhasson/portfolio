// src/app/about/edge-bend-dom.ts
/**
 * The glass edges without the lens (edge-bend.ts; Liam, 2026-10-19): the testimonials' words, split so their letters can bend.
 *
 * Each target (a quote, its attribution) gets an aria-hidden copy laid exactly over its own text: one absolutely placed
 * span per letter, at the place the browser laid that letter out (its line from a range over it, its place along the line
 * from the line's text as shaped in the same font: the original's kerning and line breaks), grouped in one span per line. The original stays where it is, read by screen readers, selected and
 * found as before; while any letter of a target bends, the target's own text is see-through (-webkit-text-fill-color, so its
 * colour stays readable) and the copy shows instead, else the copy is hidden and the original shows: the copy only ever
 * takes over while it is bending.
 *
 * Each frame: one rect per target is read (nothing is written before), then only the letters whose transform changed are
 * written, transforms only (no layout property, no will-change: transformed text is painted afresh at its scale, crisp).
 * Each letter in a band gets its own matrix (edge-bend.ts bendBox: its line's height and its own advance, pulled toward
 * the rim and stretched along the edge's normal, along the diagonal in a corner). The copy is laid out again whenever a
 * target's size changes (a ResizeObserver), the reads for every target first, then the writes.
 */
import { bendBox, type BendScreen } from "./edge-bend";

type Glyph = { el: HTMLSpanElement; x: number; w: number; tf: string };
type Row = { el: HTMLSpanElement; top: number; h: number; glyphs: Glyph[] };
type Target = { el: HTMLElement; copy: HTMLSpanElement; rows: Row[]; on: boolean; bent: Set<Glyph> };

/** A laid-out letter, read from the original: its text, its line (0 the first), its place along it (px in the target's
 *  padding box), its advance and colour. */
type Read = { ch: string; line: number; x: number; w: number; color: string; opacity?: string };

/** One frame's bend: the screen as the lens bends it, and a horizontal correction (px) for where the targets show this
 *  frame (the track as the page's scroll places it, a frame ahead of its own handler). */
export type BendFrame = { screen: BendScreen; dx: number };

export interface EdgeBend {
  /** One frame (null: nothing bends, everything put back). Returns how many letters are bent. */
  frame(f: BendFrame | null): number;
  dispose(): void;
}

const fmt = (v: number, d: number) => {
  const s = v.toFixed(d);
  return s === "-0" || /^-0\.0+$/.test(s) ? s.slice(1) : s;
};

let measurer: CanvasRenderingContext2D | null | undefined;
/** A 2D context to measure text with (null where there is none). */
function measureCtx(): CanvasRenderingContext2D | null {
  if (measurer === undefined) {
    try { measurer = document.createElement("canvas").getContext("2d"); } catch { measurer = null; }
    if (measurer && "fontKerning" in measurer) measurer.fontKerning = "normal";
  }
  return measurer;
}

const fontOf = (cs: CSSStyleDeclaration) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

type Char = { ch: string; color: string; font: string; upper: boolean; ls: number; left: number | null; top: number | null };

/**
 * The letters of a target as laid out (reads only). A range over each letter tells its line (WebKit rounds those rects to
 * whole px, so not its exact place); its place along the line is the line's start plus the line's text up to it as the
 * browser shapes it (a 2D context measuring with the same font: the kerning included), plus any letter-spacing.
 */
function readTarget(el: HTMLElement, copy: HTMLSpanElement, lineH: number): Read[] {
  const box = el.getBoundingClientRect();
  if (box.width <= 0 && box.height <= 0) return [];
  const cs0 = getComputedStyle(el);
  const ox = box.left + el.clientLeft, oy = box.top + el.clientTop;
  const padL = parseFloat(cs0.paddingLeft) || 0;
  const range = document.createRange();
  const styles = new Map<Element, Omit<Char, "ch" | "left" | "top">>();
  const chars: Char[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (copy.contains(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    const t = n.data, parent = n.parentElement;
    if (!parent || !t) continue;
    let st = styles.get(parent);
    if (!st) {
      const cs = getComputedStyle(parent);
      st = { color: cs.color, font: fontOf(cs), upper: cs.textTransform === "uppercase", ls: parseFloat(cs.letterSpacing) || 0 };
      styles.set(parent, st);
    }
    for (let i = 0; i < t.length; ) {
      const cp = t.codePointAt(i)!, len = cp > 0xffff ? 2 : 1, ch = t.slice(i, i + len);
      let left: number | null = null, top: number | null = null;
      if (!/\s/.test(ch)) {
        range.setStart(n, i); range.setEnd(n, i + len);
        const rs = range.getClientRects();
        const r = rs.length ? rs[0] : range.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) { left = r.left - ox; top = r.top - oy; }
      }
      chars.push({ ch, ...st, left, top });
      i += len;
    }
  }
  const firstTop = chars.find((c) => c.top !== null)?.top;
  if (firstTop === undefined || firstTop === null) return [];
  // the lines: each letter's by its rect; a space goes with the letter before it (one at a wrap ends its line)
  const lines: Char[][] = [];
  let cur = -1;
  for (const c of chars) {
    if (c.top !== null) cur = Math.max(0, Math.round((c.top - firstTop) / lineH));
    else if (!/\s/.test(c.ch)) continue; // (a letter with no box: not laid out)
    if (cur < 0) continue;
    (lines[cur] ??= []).push(c);
  }
  const ctx = measureCtx();
  const out: Read[] = [];
  lines.forEach((line, li) => {
    if (!line) return;
    // (white space as laid out: none leading, runs as one)
    const cs = line.filter((c, i) => !/\s/.test(c.ch) || (i > 0 && !/\s/.test(line[i - 1].ch)));
    while (cs.length && /\s/.test(cs[0].ch)) cs.shift();
    if (!cs.length) return;
    let start = cs[0].left ?? padL;
    if (Math.abs(start - padL) < 1.5) start = padL; // (the line starts at the content's edge: exactly there)
    let prefix = "", spaced = 0;
    for (const c of cs) {
      const ch = /\s/.test(c.ch) ? " " : c.upper ? c.ch.toUpperCase() : c.ch;
      let x: number, w: number;
      if (ctx) {
        ctx.font = c.font;
        const before = ctx.measureText(prefix).width;
        x = start + before + spaced;
        w = ctx.measureText(prefix + ch).width - before;
      } else {
        x = c.left ?? start; w = 0;
      }
      if (ch !== " " && c.left !== null) out.push({ ch, line: li, x, w: w > 0 ? w : 0.5 * lineH, color: c.color });
      prefix += ch; spaced += c.ls * ch.length;
    }
  });
  // the quote's mark (about.css: an absolutely placed ::before at its first line, left of the text): a letter of the copy too
  const ps = getComputedStyle(el, "::before");
  const content = ps.content;
  if (out.length && ps.position === "absolute" && content && content !== "none" && content !== "normal") {
    const m = /^"(.*)"$/.exec(content);
    const left = parseFloat(ps.left);
    if (m && m[1] && Number.isFinite(left)) {
      const ch = m[1].replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)));
      let w = 0.45 * (parseFloat(ps.fontSize) || lineH);
      if (ctx) { ctx.font = fontOf(ps); w = ctx.measureText(ch).width || w; }
      out.unshift({ ch, line: 0, x: left, w, color: ps.color, opacity: ps.opacity });
    }
  }
  return out;
}

/** The copy, from a target's letters (writes only): one span per line (the lines one line-height apart from the padding's
 *  edge), one per letter, each where the original put it. */
function writeTarget(t: Target, reads: Read[], padTop: number, lineH: number) {
  t.copy.textContent = "";
  t.rows = []; t.bent.clear(); t.on = false;
  delete t.el.dataset.bend;
  if (!reads.length) return;
  const frag = document.createDocumentFragment();
  const rows = new Map<number, Row>();
  for (const r of reads) {
    let row = rows.get(r.line);
    if (!row) {
      const el = document.createElement("span");
      el.className = "ab-bend-l";
      row = { el, top: padTop + r.line * lineH, h: lineH, glyphs: [] };
      el.style.top = `${row.top}px`;
      el.style.height = `${lineH}px`;
      rows.set(r.line, row);
      t.rows.push(row);
      frag.appendChild(el);
    }
    const g = document.createElement("span");
    g.className = "ab-bend-c";
    g.textContent = r.ch;
    g.style.left = `${r.x}px`;
    g.style.color = r.color;
    if (r.opacity !== undefined) g.style.opacity = r.opacity;
    row.el.appendChild(g);
    row.glyphs.push({ el: g, x: r.x, w: r.w, tf: "" });
  }
  t.copy.appendChild(frag);
}

/** The bend for the targets, or null where it can't be laid out (no ranges with rects: jsdom). */
export function createEdgeBend(targets: HTMLElement[]): EdgeBend | null {
  if (typeof document === "undefined" || typeof document.createRange !== "function") return null;
  if (typeof Range === "undefined" || typeof Range.prototype.getClientRects !== "function") return null;
  const ts: Target[] = targets.map((el) => {
    const copy = document.createElement("span");
    copy.className = "ab-bend";
    copy.setAttribute("aria-hidden", "true");
    el.classList.add("ab-bendable");
    el.appendChild(copy);
    return { el, copy, rows: [], on: false, bent: new Set() };
  });

  /** Lays out the copies of the targets given: every read first, then every write. */
  const layout = (which: Target[]) => {
    const reads = which.map((t) => {
      const cs = getComputedStyle(t.el);
      const fs = parseFloat(cs.fontSize) || 16;
      const lh = parseFloat(cs.lineHeight);
      const lineH = Number.isFinite(lh) ? lh : 1.2 * fs;
      return { t, r: readTarget(t.el, t.copy, lineH), padTop: parseFloat(cs.paddingTop) || 0, lineH };
    });
    for (const { t, r, padTop, lineH } of reads) writeTarget(t, r, padTop, lineH);
  };
  layout(ts);
  const ro = typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
      const which = ts.filter((t) => entries.some((e) => e.target === t.el));
      if (which.length) layout(which);
    })
    : null;
  // (the observer's first call, for each target as it is now, lays them out again: the same reads, harmless)
  ts.forEach((t) => ro?.observe(t.el));

  const put = (p: Glyph, tf: string) => {
    if (p.tf === tf) return;
    p.tf = tf;
    p.el.style.transform = tf;
  };
  const show = (t: Target, on: boolean) => {
    if (t.on === on) return;
    t.on = on;
    if (on) t.el.dataset.bend = ""; else delete t.el.dataset.bend;
  };
  const reset = (t: Target) => {
    for (const p of t.bent) put(p, "");
    t.bent.clear();
    show(t, false);
  };

  let any = false;
  return {
    frame(f) {
      if (!f || f.screen.pull <= 0) {
        if (any) { ts.forEach(reset); any = false; }
        return 0;
      }
      const sc = f.screen, { w: W, h: H, band } = sc;
      // the reads: one rect per target, before any write
      const boxes = ts.map((t) => (t.rows.length ? { r: t.el.getBoundingClientRect(), cl: t.el.clientLeft, ct: t.el.clientTop } : null));
      let n = 0;
      ts.forEach((t, i) => {
        const b = boxes[i]?.r;
        // (a target clear of every band has nothing to bend)
        const clear = !b || (b.left + f.dx >= band && b.right + f.dx <= W - band && b.top >= band && b.bottom <= H - band)
          || (sc.sides && b.left + f.dx >= sc.depth && b.right + f.dx <= W - sc.depth);
        if (clear) { if (t.bent.size || t.on) reset(t); return; }
        const ox = b.left + boxes[i]!.cl + f.dx, oy = b.top + boxes[i]!.ct;
        const now = new Set<Glyph>();
        for (const row of t.rows) {
          const y0 = oy + row.top, y1 = y0 + row.h;
          if (y1 <= 0 || y0 >= H) continue; // (off the screen: pulled further off, nothing to see)
          const rowIn = y0 < band || y1 > H - band;
          for (const g of row.glyphs) {
            const x0 = ox + g.x, x1 = x0 + g.w;
            if ((!rowIn && x0 >= band && x1 <= W - band) || x1 <= 0 || x0 >= W) continue;
            const m = bendBox(x0, y0, x1, y1, sc);
            if (!m) continue;
            put(g, `matrix(${fmt(m[0], 4)}, ${fmt(m[1], 4)}, ${fmt(m[2], 4)}, ${fmt(m[3], 4)}, ${fmt(m[4], 2)}, ${fmt(m[5], 2)})`);
            now.add(g);
          }
        }
        for (const p of t.bent) if (!now.has(p)) put(p, "");
        t.bent = now;
        show(t, now.size > 0);
        n += now.size;
      });
      any = n > 0;
      return n;
    },
    dispose() {
      ro?.disconnect();
      for (const t of ts) {
        t.copy.remove();
        t.el.classList.remove("ab-bendable");
        delete t.el.dataset.bend;
      }
    },
  };
}
