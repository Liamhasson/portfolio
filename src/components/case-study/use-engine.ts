"use client";
import { useEffect, useRef } from "react";

/** Mounts a board engine on the element once fonts are in, and tears it all down on unmount (Part C plan, Review
    Focus 1): leaving a case study by a link must leave nothing of it running or pinned. */
export function useEngine(mount: (root: HTMLElement) => () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive && ref.current) cleanup = mount(ref.current);
    });
    return () => {
      alive = false;
      cleanup?.();
    };
    // mounted once per page; `mount` is a module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
