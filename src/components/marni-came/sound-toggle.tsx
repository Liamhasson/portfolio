"use client";
import { useSyncExternalStore } from "react";
import type { AudioController } from "@/lib/marni-came/audio";

/** "Sound off / Sound on": the one control for the page's music (off until clicked). */
/** `burn`: a film-burn loop screened inside the pill while the sound is on (Liam 10-20 and 10-22). */
export function SoundToggle({ ctrl, className, burn }: { ctrl: AudioController; className?: string; burn?: string }) {
  const on = useSyncExternalStore(ctrl.subscribe, () => ctrl.state().on, () => false);
  return (
    <button type="button" className={className} aria-pressed={on} onClick={() => ctrl.toggle()} data-sound-toggle="">
      {burn && on && <video className="snd-burn" src={burn} autoPlay muted loop playsInline aria-hidden="true" />}
      <span>{on ? "Sound on" : "Sound off"}</span>
      <i aria-hidden="true" data-on={on ? "" : undefined} />
    </button>
  );
}
