"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MOVES_FRAG, MOVES_VERT, OFF, burnBreath, settled, sliceOffsets, stepMoves, type DoubledSpec, type MoveState } from "@/lib/marni-came/moves";

const noop = () => () => {};
const hasWebGL2 = () => typeof window.WebGL2RenderingContext !== "undefined";

type Props = { src: string; alt: string; burnSrc: string; doubled: DoubledSpec; state: MoveState; seed?: number; className?: string };

/** One archive image with the four moves applied live in WebGL2. Without WebGL2, or once its context is lost, the plain
 *  image stays (data-fallback="true") and the moves simply don't show. Draws only while a move is changing or the burn
 *  is on, and never animates under reduced motion. */
export function MovesCanvas({ src, alt, burnSrc, doubled, state, seed = 3, className }: Props) {
  const supported = useSyncExternalStore(noop, hasWebGL2, () => false);
  const [lost, setLost] = useState(false);
  const ok = supported && !lost;
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(state);
  const kick = useRef<() => void>(() => {});
  // (the doubled spec by value, so a parent passing a fresh object each render doesn't rebuild the GL program)
  const dkey = `${doubled.box.join(",")}|${doubled.dx}|${doubled.dy}|${doubled.scale}`;

  useEffect(() => {
    const cv = canvas.current;
    if (!ok || !cv) return;
    const gl = cv.getContext("webgl2", { premultipliedAlpha: false, antialias: false });
    // (no context, or a failed program: fall back to the plain image, after this effect)
    const fail = () => queueMicrotask(() => setLost(true));
    if (!gl) { fail(); return; }
    const onLost = (e: Event) => { e.preventDefault(); setLost(true); };
    cv.addEventListener("webglcontextlost", onLost);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const sh = (type: number, code: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, code); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    const vs = sh(gl.VERTEX_SHADER, MOVES_VERT), fs = sh(gl.FRAGMENT_SHADER, MOVES_FRAG);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.removeEventListener("webglcontextlost", onLost); fail(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    gl.uniform1fv(u("uOffsets"), sliceOffsets(seed));
    gl.uniform4f(u("uBox"), ...doubled.box); gl.uniform2f(u("uD"), doubled.dx, doubled.dy); gl.uniform1f(u("uScale"), doubled.scale);
    gl.uniform1i(u("uImg"), 0); gl.uniform1i(u("uLight"), 1);

    const textures: WebGLTexture[] = [];
    const tex = (unit: number, url: string, onSize?: (w: number, h: number) => void) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => {
        if (gone) { res(); return; }
        const t = gl.createTexture()!; textures.push(t); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        // (mipmapped: the blowout reads its glow from the blurred levels)
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        onSize?.(im.naturalWidth, im.naturalHeight); res();
      };
      im.onerror = () => res();
      im.src = url;
    });

    const t0 = performance.now();
    let cur: MoveState = { ...OFF }, raf = 0, last = 0, ready = false, gone = false, seen = true;
    const draw = (now: number) => {
      raf = 0;
      if (gone || !ready) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      cur = stepMoves(cur, target.current, dt, reduced);
      gl.uniform1f(u("uSlice"), cur.slice); gl.uniform1f(u("uBurn"), cur.burn); gl.uniform1f(u("uDoubled"), cur.doubled); gl.uniform1f(u("uLens"), cur.lens); gl.uniform1f(u("uBlowout"), cur.blowout);
      gl.uniform1f(u("uBreath"), reduced ? 0.5 : burnBreath((now - t0) / 1000));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // (the burn breathes while it's on, but only while the picture is on screen)
      if (!reduced && (!settled(cur, target.current) || (cur.burn > 0 && seen))) raf = requestAnimationFrame(draw);
      else last = 0;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    kick.current = schedule;
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(cv.clientWidth * dpr)); cv.height = Math.max(1, Math.round(cv.clientHeight * dpr));
      gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(u("uRes"), cv.width, cv.height); schedule();
    };
    const ro = new ResizeObserver(size); ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) schedule(); });
    io.observe(cv);
    Promise.all([tex(0, src, (w, h) => gl.uniform2f(u("uImgSize"), w, h)), tex(1, burnSrc)]).then(() => { if (gone) return; ready = true; size(); });
    return () => {
      gone = true; ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); cv.removeEventListener("webglcontextlost", onLost); kick.current = () => {};
      // release everything this context holds (the context itself goes with its canvas; losing it here would break
      // React's development double-run, which re-uses the same canvas)
      textures.forEach((t) => gl.deleteTexture(t)); gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, src, burnSrc, seed, dkey]);

  useEffect(() => { target.current = state; kick.current(); }, [state]);

  return (
    <div className={className} data-fallback={ok ? undefined : "true"} style={{ position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={ok ? "" : alt} aria-hidden={ok ? true : undefined} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      {ok && <canvas key={`${src}|${burnSrc}|${seed}|${dkey}`} ref={canvas} role="img" aria-label={alt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}
    </div>
  );
}
