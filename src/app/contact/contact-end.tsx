// src/app/contact/contact-end.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT } from "@/content/about";

/**
 * Contact's words (spec 2026-10-12-about-contact-design.md §4): the headline, then Email, LinkedIn, Phone as pills in
 * the nav's style. A click on the email copies it ("Copied" in place for 2 s); from the keyboard, or where there is no
 * clipboard, it is a plain mailto:. `show` (0..1): how far the words have arrived; before, they are inert.
 */
export function ContactEnd({ show }: { show: number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onEmail = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (e.detail === 0 || !clip?.writeText) return;   // (keyboard, or no clipboard: the mailto: opens)
    e.preventDefault();
    clip.writeText(CONTACT.email).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }, () => { window.location.href = `mailto:${CONTACT.email}`; });
  };
  const k = Math.min(Math.max(show, 0), 1);
  return (
    <div data-testid="contact-words" className="ct-words" inert={k < 0.5 ? true : undefined}
      style={{ opacity: String(k), transform: `translateY(${(1 - k) * 14}px)` }}>
      <h1 className="ct-head">{CONTACT.headline}</h1>
      <div className="ct-pills">
        {/* the address and "Copied" share one grid cell, so the pill keeps its width (Liam, 2026-10-12); its name stays
            the address, the status line below says it was copied */}
        <a href={`mailto:${CONTACT.email}`} onClick={onEmail} aria-label={CONTACT.email} className="ct-pill ct-swap">
          <span data-swap="" style={{ visibility: copied ? "hidden" : "visible" }}>{CONTACT.email}</span>
          <span data-swap="" aria-hidden style={{ visibility: copied ? "visible" : "hidden" }}>Copied</span>
        </a>
        <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" className="ct-pill">LinkedIn ↗</a>
        <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="ct-pill">{CONTACT.phone}</a>
      </div>
      <p role="status" className="sr-only">{copied ? "Copied" : ""}</p>
    </div>
  );
}
