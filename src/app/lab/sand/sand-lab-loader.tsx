"use client";

import dynamic from "next/dynamic";

// WebGL only exists in the browser: never prerender the stage.
const SandLab = dynamic(() => import("./sand-lab").then((m) => m.SandLab), { ssr: false });

export function SandLabLoader({ hero }: { hero: boolean }) {
  return <SandLab hero={hero} />;
}
