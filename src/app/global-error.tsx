"use client";

/** The root layout itself broke: its own document, styled inline (no global styles reach here). */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pill = { padding: "0.85em 1.5em", borderRadius: 99, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(20,16,15,0.7)", color: "#f4efe9", font: "inherit", textDecoration: "none", cursor: "pointer" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100svh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 4.9vw", background: "#0b0908", color: "#f4efe9", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <title>Liam Hasson</title>
        <h1 style={{ fontSize: "clamp(40px, 7.2vw, 104px)", fontWeight: 400, lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0 }}>Something broke on this page.</h1>
        <div style={{ display: "flex", gap: 12, marginTop: "2.4em" }}>
          <button type="button" style={pill} onClick={() => retry()}>Try again</button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the layout is down: a full reload */}
          <a href="/" style={pill}>Back to the start</a>
        </div>
      </body>
    </html>
  );
}
