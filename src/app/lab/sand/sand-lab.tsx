"use client";

import { useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSand, SAND_BASE } from "@/three/sand/data";
import { SandField, type SandState } from "@/three/sand/sand-field";
import { PaintField } from "@/three/sand/paint";
import { Wordmark } from "@/three/sand/wordmark";
import * as THREE from "three";
import { parseTierOverride, pickTier, readSignals } from "@/three/tier";

type CompareTarget = "chaos" | "mid" | "ball";
const COMPACT_FOR: Record<CompareTarget, number> = { chaos: 0, mid: 0.5, ball: 1 };

/** Scroll progress (0..1 over the page) to compaction: hold the chaos, pull it in, hold the ball. */
function compactFor(progress: number): number {
  const t = Math.min(Math.max((progress - 0.12) / 0.7, 0), 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate-independent damping toward a target. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function SandLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compare] = useState<CompareTarget | null>(() => {
    const v = new URLSearchParams(window.location.search).get("compare");
    return v === "chaos" || v === "mid" || v === "ball" ? v : null;
  });
  const [split, setSplit] = useState(50);
  const [status, setStatus] = useState("loading sand");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let stage: Stage | null = null;
    let field: SandField | null = null;
    let paint: PaintField | null = null;
    let wordmark: Wordmark | null = null;
    const listeners: [string, EventListener][] = [];

    (async () => {
      const data = await loadSand(SAND_BASE);
      if (disposed) return;
      const { camera } = data.meta;
      const probe = document.createElement("canvas").getContext("webgl2");
      const tier = pickTier(readSignals(probe), parseTierOverride(window.location.search));
      stage = new Stage(
        canvas,
        {
          position: camera.position,
          target: camera.target,
          lensMm: camera.lens_mm,
          sensorMm: camera.sensor_mm,
          renderAspect: camera.render[0] / camera.render[1],
        },
        tier,
        compare !== null,
      );
      field = new SandField(data);
      stage.scene.add(field.points);
      // ?weight=bold|black|ultrablack: compare the wordmark's weight (default black); ?wordmark=0 hides it
      const params = new URLSearchParams(window.location.search);
      if (params.get("wordmark") !== "0" && !compare) {
        const weight = { bold: "Bold", black: "Black", ultrablack: "UltraBlack" }[params.get("weight") ?? "black"] ?? "Black";
        wordmark = await Wordmark.create(data.meta, `/lab/fonts/Geist-${weight}.ttf`);
        if (disposed) return;
        stage.scene.add(wordmark.mesh);
      }
      stage.onSettings((s) => {
        field!.setGrains(s.grains);
        field!.setShadowSteps(s.shadowSteps);
        field!.setPointScale(stage!.bufferHeight, (stage!.camera.fov * Math.PI) / 180);
        setStatus(`${s.tier} · ${s.grains.toLocaleString()} grains · ${s.shadowSteps} shadow steps · dpr ${s.pixelRatio}`);
      });

      const state: SandState = { compact: 0, time: 0, ballSpin: 0, chaosSpin: 0 };
      if (compare) {
        // frozen, at the exact Blender camera: comparable pixel for pixel with the render
        state.compact = COMPACT_FOR[compare];
        field.update(state);
        stage.renderOnce();
        const w = window as unknown as { __sandReady?: boolean; __sandLook?: (l: Record<string, number>) => void };
        w.__sandLook = (look) => {
          field!.setLook(look);
          stage!.renderOnce();
        };
        w.__sandReady = true;
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // ?still: no ambient motion (drift, spin), so a test isolates what the cursor does
      const still = new URLSearchParams(window.location.search).has("still");
      let lastScroll = window.scrollY;
      let spinVel = 0;

      // the cursor: a light (Lusion model) and, unless motion is reduced, a soft drift
      paint = new PaintField();
      const sizePaint = () => {
        paint!.setSize(canvas.clientWidth, canvas.clientHeight);
        field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
      };
      sizePaint();
      stage.onSettings(sizePaint);
      if (reduced) field.setLook({ paintScale: 0 });
      const pointer = { x: 0, y: 0, active: false, touch: false };
      let cursorI = 0;
      const on = (type: string, fn: EventListener) => {
        window.addEventListener(type, fn, { passive: true });
        listeners.push([type, fn]);
      };
      on("pointermove", ((e: PointerEvent) => {
        pointer.x = e.clientX; pointer.y = e.clientY;
        pointer.touch = e.pointerType === "touch";
        // a mouse lights the sand wherever it is; a finger only while it touches
        if (!pointer.touch || e.buttons) { pointer.active = true; paint!.move(e.clientX, e.clientY); }
      }) as EventListener);
      on("pointerdown", ((e: PointerEvent) => {
        pointer.x = e.clientX; pointer.y = e.clientY; pointer.touch = e.pointerType === "touch";
        pointer.active = true; paint!.move(e.clientX, e.clientY);
      }) as EventListener);
      const lift = ((e: PointerEvent) => {
        if (e.pointerType === "touch") { pointer.active = false; paint!.release(); }
      }) as EventListener;
      on("pointerup", lift);
      on("pointercancel", lift);
      const leave = () => { pointer.active = false; paint!.release(); };
      document.documentElement.addEventListener("mouseleave", leave);
      listeners.push(["__leave", leave]);
      const ndc = new THREE.Vector3();
      const cursorWorld = new THREE.Vector3();
      const focus = new THREE.Vector3();
      const forward = new THREE.Vector3();
      const chaosC = field.material.uniforms.uChaosC.value as THREE.Vector3;
      const ballC = field.material.uniforms.uBallC.value as THREE.Vector3;

      stage.onFrame((dt) => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = window.scrollY / max;
        state.compact = damp(state.compact, compactFor(progress), 6, dt);
        // scroll turns the ball; when scrolling stops it keeps a slow idle spin
        const scrolled = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        spinVel = damp(spinVel, scrolled * 0.004 / Math.max(dt, 1e-3), 4, dt);
        if (!reduced && !still) {
          state.time += dt;
          state.ballSpin += dt * 0.12 + spinVel * dt;
          state.chaosSpin += dt * 0.015;
        }
        // the cursor light: on a camera-facing plane through the sand, a little in front of it
        const cam = stage!.camera;
        focus.lerpVectors(chaosC, ballC, state.compact);
        cam.getWorldDirection(forward);
        ndc.set((pointer.x / canvas.clientWidth) * 2 - 1, -(pointer.y / canvas.clientHeight) * 2 + 1, 0.5).unproject(cam);
        const dir = ndc.sub(cam.position).normalize();
        const dist = focus.clone().sub(cam.position).dot(forward) / Math.max(dir.dot(forward), 1e-4);
        cursorWorld.copy(cam.position).addScaledVector(dir, dist - 0.45);
        cursorI = damp(cursorI, pointer.active ? 1 : 0, pointer.active ? 5 : 2.5, dt);
        field!.setCursor(cursorWorld, cursorI);
        if (!reduced) {
          paint!.update(stage!.renderer, dt);
          field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
        }
        wordmark?.setPaint(reduced ? null : paint!.texture, canvas.width, canvas.height);
        wordmark?.update(dt, reduced || still);
        field!.update(state);
      });
      stage.start();
      (window as unknown as { __sand?: unknown }).__sand = { stage, field, state };   // lab debugging
    })().catch((err) => setStatus(String(err)));

    return () => {
      disposed = true;
      for (const [type, fn] of listeners) {
        if (type === "__leave") document.documentElement.removeEventListener("mouseleave", fn);
        else window.removeEventListener(type, fn);
      }
      paint?.dispose();
      wordmark?.dispose();
      field?.dispose();
      stage?.dispose();
    };
  }, [compare]);

  if (compare) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black">
        <div className="relative" style={{ width: "min(100vw, 160vh)", aspectRatio: "16 / 10" }}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" data-testid="sand-canvas" />
          {/* eslint-disable-next-line @next/next/no-img-element -- a lab overlay, compared pixel for pixel */}
          <img
            src={`${SAND_BASE}/targets/${compare}.jpg`}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
            data-testid="sand-target"
          />
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white/60" style={{ left: `${split}%` }} data-testid="sand-split" />
          <div className="absolute left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/70">
            live ← | → render · {compare} · {status}
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Split between the live sand and the render"
            className="absolute bottom-4 left-1/2 w-1/2 -translate-x-1/2"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black" style={{ height: "400vh" }}>
      <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen" data-testid="sand-canvas" />
      <div className="pointer-events-none fixed left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/60">
        sand lab · {status}
      </div>
    </div>
  );
}
