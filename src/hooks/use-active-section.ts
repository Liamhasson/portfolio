"use client";

import { useEffect, useState } from "react";

/**
 * Id of the last section (in `ids` order) currently crossing the middle of the viewport, or null.
 * Pass a `resetKey` that changes when the page changes (e.g. the pathname) so the observer
 * re-subscribes to the new page's sections.
 */
export function useActiveSection(ids: readonly string[], resetKey?: string): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    const order = key.split("|");
    const elements = order
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(order.findLast((id) => visible.has(id)) ?? null);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    elements.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      setActive(null);
    };
  }, [key, resetKey]);

  return active;
}
