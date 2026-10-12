import Link from "next/link";

/** A wrong address (Liam, 2026-10-13): the site's own page, the way back to the start and to the projects. */
export default function NotFound() {
  return (
    <section className="st" aria-labelledby="st-h">
      <p className="st-code">404</p>
      <h1 id="st-h" className="st-title">This page isn’t here.</h1>
      <p className="st-line">The address may be from the old site, or it moved.</p>
      <div className="st-actions">
        <Link href="/" className="st-pill">Back to the start</Link>
        <Link href="/#projects" className="st-pill">See the projects</Link>
      </div>
    </section>
  );
}
