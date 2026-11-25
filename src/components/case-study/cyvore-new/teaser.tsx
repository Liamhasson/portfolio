import { BackButton } from "@/components/shell/back-button";
import { cyvoreNew } from "@/content/cyvore-new";
import { AtAGlance } from "../at-a-glance";
import { IconSprite } from "../icons";
import { NextProject } from "../next-project";
import { SnapshotFrame } from "./snapshot-frame";
import "./cyvore-new.css";

/** The Cyvore new website, coming soon (spec docs/superpowers/specs/2026-11-25-cyvore-new-website-teaser-design.md):
 *  the site's live hero, the at-a-glance, a few lines in Liam's words, and the way on. No results: it isn't launched. */
export function Teaser() {
  const c = cyvoreNew;
  return (
    <article data-world="cyvore-new" className="cs">
      <IconSprite />
      <BackButton slug={c.slug} />
      <header className="f hero">
        <div className="hero-head">
          <p className="label">Coming soon<span className="tag">In progress</span></p>
          <h1 id="case-title" tabIndex={-1} className="title">{c.title}</h1>
          <p className="hero-line">{c.line}</p>
        </div>
        <SnapshotFrame />
      </header>
      <AtAGlance data={c.atAGlance} />
      <section className="f about" aria-labelledby="cn-about">
        <h2 id="cn-about" className="label">The project</h2>
        <div className="about-body">
          {c.body.map((p) => <p key={p}>{p}</p>)}
          <p className="soon">{c.soon}</p>
        </div>
      </section>
      <NextProject from="cyvore-new" />
    </article>
  );
}
