// src/app/contact/contact-scene.tsx
"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSandMeta, loadSandParts, SAND_BASE } from "@/three/sand/data";
import { SandField, type SandState } from "@/three/sand/sand-field";
import { SAND_ENCODE, SAND_LAYER, SandComposite } from "@/three/sand/sand-composite";
import { FilmGradePass } from "@/three/sand/film-grade-pass";
import { PaintField } from "@/three/sand/paint";
import { LoadProgress } from "@/three/sand/load-progress";
import { anchorsWorld } from "@/three/sand/cascade";
import { ballKeyPos } from "@/three/sand/ball-light";
import { contactView } from "@/three/sand/contact-view";
import { parseTierOverride, pickTier, readSignals, settingsFor } from "@/three/tier";
import { Brief, type BriefHandle, BriefGrowth } from "@/app/lab/sand/brief";
import { contactAt, contactStalled } from "./contact-timeline";
import { ContactEnd } from "./contact-end";
import "./contact.css";

const damp = (a: number, b: number, k: number, dt: number) => b + (a - b) * Math.exp(-k * dt);

/**
 * Contact (spec 2026-10-12-about-contact-design.md §4): the loader's entry, ending on the ball. The brief grows from a
 * point while the sand loads (its size the progress); at 100% its corners round, its anchors become grains and split
 * (the loader's cascade), and the grains gather into the ball inside the brief, which stays. Then the words. The ball
 * keeps its slow spin; the cursor's light touches it. Reduced motion: the ball held formed, the brief drawn. No WebGL,
 * an error or a stalled load: the ball as a still with the brief over it, and the words.
 */
export function ContactScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const briefRef = useRef<BriefHandle>(null);
  const [words, setWords] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let stage: Stage | null = null, field: SandField | null = null, paint: PaintField | null = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = new LoadProgress();
    progress.expect("/lab/grain.png", 60e3);
    progress.expect("haze", 90e3);
    const growth = new BriefGrowth();
    let ball = { cx: window.innerWidth / 2, cy: window.innerHeight * 0.42, r: window.innerHeight * 0.15 };
    let since = 0, last = performance.now(), lastP = -1, stalledFor = 0, raf = 0, growing = true;
    let onFull: (() => void) | null = null;
    const cleanups: (() => void)[] = [];
    // the still: no WebGL, an error, or a stalled load; never a blank page
    const giveUp = () => {
      growing = false; cancelAnimationFrame(raf);
      stage?.stop();
      setStill(true); setWords(1);
      briefRef.current?.update({ cx: window.innerWidth / 2, cy: window.innerHeight * 0.42, r: window.innerHeight * 0.15, alpha: 1, dash: 0, squares: Array(9).fill(1), round: 1 });
    };
    // the brief grows on its own frames while the sand loads (the stage isn't there yet)
    const grow = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now; since += dt;
      if (progress.value !== lastP) { lastP = progress.value; stalledFor = 0; } else stalledFor += dt;
      if (contactStalled(stalledFor, progress.value)) { giveUp(); return; }
      const size = growth.step(progress.value, since, dt);
      briefRef.current?.update({ ...ball, r: ball.r * size, alpha: 1, dash: 0, squares: Array(9).fill(1), round: 0 });
      briefRef.current?.announce(progress.value);
      if (size >= 0.999 && onFull) { const f = onFull; onFull = null; f(); }
      if (growing) raf = requestAnimationFrame(grow);
    };
    raf = requestAnimationFrame(grow);

    (async () => {
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe || new URLSearchParams(window.location.search).has("nogl")) { giveUp(); return; }   // (?nogl: the fallback, as in the story)
      const tier = pickTier(readSignals(probe), parseTierOverride(window.location.search));
      const meta = await loadSandMeta(SAND_BASE);
      if (disposed) return;
      const { camera } = meta;
      stage = new Stage(canvas, { position: camera.position, target: camera.target, lensMm: camera.lens_mm, sensorMm: camera.sensor_mm, renderAspect: camera.render[0] / camera.render[1] }, tier, false);
      const st = stage;
      const q = st.camera.quaternion.clone(), home = st.camera.position.clone();
      const ballC = new THREE.Vector3(...meta.ball.center), ballR = meta.ball.radius;
      const right = new THREE.Vector3(), up = new THREE.Vector3();
      // the framing (contact-view.ts) and the brief on the ball's projected outline, on every resize
      const frame = () => {
        st.setView(home, q, camera.lens_mm);
        st.setView(contactView(q, ballC, ballR, THREE.MathUtils.degToRad(st.camera.fov)), q, camera.lens_mm);
        right.setFromMatrixColumn(st.camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(st.camera.matrixWorld, 1).normalize();
        const p0 = ballC.clone().project(st.camera), p1 = ballC.clone().addScaledVector(right, ballR).project(st.camera);
        const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
        ball = { cx: ((p0.x + 1) / 2) * W, cy: ((1 - p0.y) / 2) * H, r: (Math.abs(p1.x - p0.x) / 2) * W };
      };
      st.onSettings((s) => { frame(); field?.setGrains(s.grains); field?.setPointScale(st.bufferHeight, THREE.MathUtils.degToRad(st.camera.fov)); });
      const data = await loadSandParts(meta, settingsFor("low", window.devicePixelRatio || 1).grains, SAND_BASE, progress);
      if (disposed) return;
      field = new SandField(data);
      st.scene.add(field.points);
      field.setGrains(st.settings.grains);
      field.setPointScale(st.bufferHeight, THREE.MathUtils.degToRad(st.camera.fov));
      // the hero's light on the ball, its key swung to the left as in the hero (ball-light.ts)
      const c: [number, number, number] = [ballC.x, ballC.y, ballC.z];
      field.setLights(field.heroLights().map((l, i) => (i === 0 ? { ...l, pos: new THREE.Vector3(...ballKeyPos([l.pos.x, l.pos.y, l.pos.z], c, 1)) } : l)));
      // the sand through the pixel filter, graded, with the hero's haze (as in the story)
      const comp = new SandComposite();
      field.points.layers.set(SAND_LAYER);
      field.material.uniforms.uOutScale.value = 1 / SAND_ENCODE;
      st.camera.layers.enable(SAND_LAYER);
      st.renderFrame = (r, sc, cam) => comp.render(r, sc, cam);
      comp.sigma = 0.28;   // (the ball's filter width: sand-lab.tsx FILTER.ball)
      new THREE.TextureLoader().loadAsync("/lab/grain.png").finally(() => progress.done("/lab/grain.png")).then((t) => {
        if (disposed) return;
        comp.grade = new FilmGradePass(t);
        comp.gradeStill = reduced;
      }).catch(() => {});
      Promise.all([
        new THREE.TextureLoader().loadAsync(`${SAND_BASE}/haze-hero.png`).finally(() => progress.done("haze")),
        fetch(`${SAND_BASE}/haze-hero.json`).then((r) => r.json() as Promise<{ scale: number }>),
      ]).then(([texture, { scale }]) => {
        texture.colorSpace = THREE.NoColorSpace;
        comp.haze = { texture, scale };
        comp.hazeAmount = 1;
      }).catch(() => {});
      await st.renderer.compileAsync(st.scene, st.camera).catch(() => {});
      await comp.warm(st.renderer, st.scene, st.camera).catch(() => {});
      progress.compile(1);
      if (disposed) return;

      // the cursor: a light, and unless motion is reduced a soft drift (as in the hero)
      paint = new PaintField();
      paint.setSize(canvas.clientWidth, canvas.clientHeight);
      field.setPaint(paint.texture, canvas.clientWidth, canvas.clientHeight);
      const pointer = { x: 0, y: 0, active: false };
      const onMove = (e: PointerEvent) => {
        pointer.x = e.clientX; pointer.y = e.clientY;
        if (e.pointerType !== "touch" || e.buttons) { pointer.active = true; paint!.move(e.clientX, e.clientY); }
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));

      // the ball, formed; until the brief is full the sand waits unborn
      const state: SandState = { compact: 1, time: 0, ballSpin: 0, chaosSpin: 0 };
      field.update(state);
      let t0: number | null = null, cascading = !reduced, cursorI = 0;
      const cursorWorld = new THREE.Vector3(), ndc = new THREE.Vector3(), fwd = new THREE.Vector3();
      if (cascading) field.setCascade(-1, anchorsWorld(c, ballR, [right.x, right.y, right.z], [up.x, up.y, up.z]).map((a) => new THREE.Vector3(...a)), "ball");
      onFull = () => { t0 = 0; };
      st.onFrame((dt) => {
        if (t0 !== null) t0 += dt;
        const k = contactAt(t0 ?? 0);
        if (t0 !== null) {
          growing = false;
          briefRef.current?.update({ ...ball, alpha: 1, dash: 0, squares: Array(9).fill(1), round: k.round });
          setWords(k.words);
        }
        if (cascading) {
          if (t0 === null) field!.setCascade(-1);
          else if (field!.cascadeDone(k.cascade)) { cascading = false; field!.setCascade(null); }
          else field!.setCascade(k.cascade, undefined, "ball");
        }
        if (!reduced) { state.time += dt; state.ballSpin += dt * 0.12; }
        // the cursor's light on the ball
        const cam = st.camera;
        cam.getWorldDirection(fwd);
        ndc.set((pointer.x / canvas.clientWidth) * 2 - 1, -(pointer.y / canvas.clientHeight) * 2 + 1, 0.5).unproject(cam);
        const dir = ndc.sub(cam.position).normalize();
        const dist = ballC.clone().sub(cam.position).dot(fwd) / Math.max(dir.dot(fwd), 1e-4);
        cursorWorld.copy(cam.position).addScaledVector(dir, dist - 0.45);
        cursorI = damp(cursorI, pointer.active ? 1 : 0, pointer.active ? 5 : 2.5, dt);
        field!.setCursor(cursorWorld, cursorI);
        if (!reduced) { paint!.update(st.renderer, dt); field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight); }
        field!.update(state);
      });
      st.start();
    })().catch(() => { if (!disposed) giveUp(); });

    return () => {
      disposed = true; growing = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      stage?.stop(); field?.dispose(); stage?.dispose();
    };
  }, []);

  return (
    <div className="ct">
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- the approved still, the no-WebGL fallback
        <img src={`${SAND_BASE}/targets/ball.jpg`} alt="" className="ct-still" />
      ) : (
        <canvas ref={canvasRef} className="ct-canvas" data-testid="contact-canvas" />
      )}
      <Brief ref={briefRef} />
      <ContactEnd show={words} />
    </div>
  );
}
