"use client";
import { useSyncExternalStore } from "react";
import type { AudioController } from "@/lib/marni-came/audio";

/** "Sound off / Sound on": the one control for the page's music (off until clicked). */
/** (The burn left the pill for the screen's edges, where it plays with the music: Liam, 2026-10-26.) */
export function SoundToggle({ ctrl, className }: { ctrl: AudioController; className?: string }) {
  const on = useSyncExternalStore(ctrl.subscribe, () => ctrl.state().on, () => false);
  return (
    <button type="button" className={className} aria-pressed={on} onClick={() => ctrl.toggle()} data-sound-toggle="">
      <span>{on ? "Sound on" : "Sound off"}</span>
      <i aria-hidden="true" data-on={on ? "" : undefined} />
    </button>
  );
}
