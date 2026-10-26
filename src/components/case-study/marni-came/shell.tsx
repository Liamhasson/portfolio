"use client";
import { useEffect, useState } from "react";
import { SoundToggle } from "@/components/marni-came/sound-toggle";
import { bridgeParent, createAudioController, type AudioController } from "@/lib/marni-came/audio";
import { BurnEdges } from "./burn-edges";

/** The study's one sound control (spec §4.5): off until clicked; it also plays what the embedded site asks for. While the
 *  music plays, the burn plays with it along the screen's edges (Liam, 2026-10-26). */
export function MarniCameShell() {
  const [ctrl, setCtrl] = useState<AudioController | null>(null);
  useEffect(() => {
    const c = createAudioController(window);
    const off = bridgeParent(c, window);
    setCtrl(c); // eslint-disable-line react-hooks/set-state-in-effect -- the controller needs the browser
    return () => { off(); c.dispose(); };
  }, []);
  return ctrl ? <><SoundToggle ctrl={ctrl} className="mc-sound" /><BurnEdges ctrl={ctrl} /></> : null;
}
