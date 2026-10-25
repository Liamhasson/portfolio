import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** The references and what each taught (Liam's BA case studies). Free-licensed Wikimedia Commons photos, graded to the
 *  brand's black and white and credited as edited (tools/marni-came/sources/refs/credits.json). */
const REFS = [
  { name: "David Bowie", line: "A persona can be built on purpose.", src: MC_ASSETS.refs.bowie, alt: "David Bowie as Ziggy Stardust, singing on stage", credit: "Boris Yaro · CC BY 4.0", href: "https://commons.wikimedia.org/wiki/File:David_Bowie,_as_Ziggy_Stardust,_performing_at_the_Santa_Monica_Civic_Auditorium_(cropped).jpg" },
  { name: "Kurt Cobain", line: "Raw beats polished.", src: MC_ASSETS.refs.cobain, alt: "Kurt Cobain playing with Nirvana under the stage lights", credit: "P.B. Rage · CC BY-SA 2.0", href: "https://commons.wikimedia.org/wiki/File:Nirvana_around_1992_(high_quality).jpg" },
  { name: "Dave Grohl", line: "Talk to the crowd like old friends.", src: MC_ASSETS.refs.grohl, alt: "Dave Grohl singing and reaching out to the crowd at Rock am Ring 2018", credit: "Andreas Lawen, Fotandi · CC BY-SA 4.0", href: "https://commons.wikimedia.org/wiki/File:Foo_Fighters_-_Rock_am_Ring_2018-5613.jpg" },
  { name: "Måneskin", line: "Keep the fans close, online too.", src: MC_ASSETS.refs.maneskin, alt: "Victoria De Angelis of Måneskin in the middle of the crowd, fans screaming and singing around her", credit: "Photographer unknown", href: "" },
] as const;

/** Board CS 03b · Strategy (Liam, 2026-10-21): the five points of his BA, sharpened: the mission, who it's for, the USP,
 *  the references and the voice. */
export function MarniCameStrategy({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec strategy ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-headline mc-mission">Nobody watches a Marni Came show. <em className="mc-red">Everyone&rsquo;s in it.</em></p>
      <div className="mc-st-row">
        <div className="mc-st-card">
          <p className="label">Target audience</p>
          <p className="mc-open mc-st-head">Rock fans and players, 18&ndash;35, in Berlin&rsquo;s scene.</p>
          <dl className="mc-st-rows">
            <div><dt className="label">They value</dt><dd className="body">Real over polished, and a crowd to belong to.</dd></div>
            <div><dt className="label">They miss</dt><dd className="body">Rock that feels made for them, not for the charts.</dd></div>
            <div><dt className="label">Where they are</dt><dd className="body">At gigs, on Instagram and Facebook, digging on Spotify, YouTube and Apple Music.</dd></div>
          </dl>
        </div>
        <div className="mc-st-card">
          <p className="label">USP</p>
          <p className="mc-open mc-st-usp">A modern grunge sound that keeps its mistakes, and a show the crowd plays in.</p>
        </div>
      </div>
      <div className="mc-st-block">
        <p className="label">References · what each taught us</p>
        <ul className="mc-st-refs">
          {REFS.map((r) => (
            <li key={r.name}>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.src} alt={r.alt} loading="lazy" />
                <figcaption className="label">{r.href ? <a href={r.href} target="_blank" rel="noreferrer">{r.credit} · edited<span className="sr-only"> (opens in a new tab)</span></a> : <>{r.credit} · edited</>}</figcaption>
              </figure>
              <p className="mc-open mc-st-name">{r.name}</p>
              <p className="body">{r.line}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mc-st-block">
        <p className="label">Voice</p>
        <p className="mc-open mc-st-rule">Talk with them, not to them.</p>
        <figure className="mc-st-voice-ph">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.backstage} alt="Liam and Imri talking with some of the audience backstage at Badehaus, before the Dopamine video shoot" loading="lazy" />
          <figcaption className="label">For example: Liam and Imri with our audience, backstage at Badehaus before the Dopamine shoot</figcaption>
        </figure>
      </div>
    </section>
  );
}
