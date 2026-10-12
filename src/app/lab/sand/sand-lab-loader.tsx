"use client";

import dynamic from "next/dynamic";

// the story's code (three.js and the scene) starts downloading as soon as this module runs, not when React first
// renders it (Liam, 2026-10-13); its data is already on its way from the HTML (src/app/story-preload.ts)
const story = typeof window !== "undefined" ? import("./sand-lab") : null;

// WebGL only exists in the browser: never prerender the stage.
const SandLab = dynamic(() => (story ?? import("./sand-lab")).then((m) => m.SandLab), { ssr: false });

export function SandLabLoader({ hero }: { hero: boolean }) {
  return <SandLab hero={hero} />;
}
