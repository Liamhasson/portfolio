"use client";
import { useEffect, useState } from "react";
import { SoundToggle } from "@/components/marni-came/sound-toggle";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import { bridgeParent, createAudioController, type AudioController } from "@/lib/marni-came/audio";

/** The study's one sound control (spec §4.5): off until clicked; it also plays what the embedded site asks for. */
export function MarniCameShell() {
  const [ctrl, setCtrl] = useState<AudioController | null>(null);
  useEffect(() => {
    const c = createAudioController(window);
    const off = bridgeParent(c, window);
    setCtrl(c); // eslint-disable-line react-hooks/set-state-in-effect -- the controller needs the browser
    return () => { off(); c.dispose(); };
  }, []);
  return ctrl ? <SoundToggle ctrl={ctrl} className="mc-sound" burn={MC_ASSETS.burnPill} /> : null;
}
