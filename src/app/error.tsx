"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./status.css";

/** A page that broke (Liam, 2026-10-13): said plainly, with another try and the way back. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="st" aria-labelledby="st-h">
      <p className="st-code">Error</p>
      <h1 id="st-h" className="st-title">Something broke on this page.</h1>
      <p className="st-line">Trying again usually fixes it.</p>
      <div className="st-actions">
        <button type="button" className="st-pill" onClick={() => retry()}>Try again</button>
        <Link href="/" className="st-pill">Back to the start</Link>
      </div>
    </section>
  );
}
