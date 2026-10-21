import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** The references and what each taught (Liam's BA case studies). Free-licensed Wikimedia Commons photos, graded to the
 *  brand's black and white and credited as edited (tools/marni-came/sources/refs/credits.json). */
const REFS = [
  { name: "David Bowie", line: "A persona can be built on purpose.", src: MC_ASSETS.refs.bowie, alt: "David Bowie as Ziggy Stardust, singing on stage", credit: "Boris Yaro · CC BY 4.0", href: "https://commons.wikimedia.org/wiki/File:David_Bowie,_as_Ziggy_Stardust,_performing_at_the_Santa_Monica_Civic_Auditorium_(cropped).jpg" },
  { name: "Kurt Cobain", line: "Raw beats polished.", src: MC_ASSETS.refs.cobain, alt: "Kurt Cobain playing with Nirvana under the stage lights", credit: "P.B. Rage · CC BY-SA 2.0", href: "https://commons.wikimedia.org/wiki/File:Nirvana_around_1992_(high_quality).jpg" },
  { name: "Dave Grohl", line: "Talk to the crowd like old friends.", src: MC_ASSETS.refs.grohl, alt: "Dave Grohl laughing on stage with his guitar", credit: "Roger Woolman · CC BY 3.0", href: "https://commons.wikimedia.org/wiki/File:Dave_Grohl_(55208432).jpeg" },
  { name: "Måneskin", line: "Keep the fans close, online too.", src: MC_ASSETS.refs.maneskin, alt: "Damiano David of Måneskin on stage, arms wide", credit: "Mr. Rossi · CC BY-SA 4.0", href: "https://commons.wikimedia.org/wiki/File:M%C3%A5neskin_-_Rock_im_Park_2022_-_IMG_1401_-_1.jpg" },
] as const;

/** Board CS 03b · Strategy (Liam, 2026-10-21): the five points of his BA, sharpened: the mission, who it's for, the USP,
 *  the references and the voice. */
export function MarniCameStrategy({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec strategy ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="label">Mission</p>
      <p className="mc-mission">Nobody watches<br /> a Marni Came show.<br /> Everyone&rsquo;s in it.</p>
      <div className="mc-st-row">
        <div className="mc-st-card">
          <p className="label">Target audience</p>
          <p className="mc-st-head">Rock fans and players, 18&ndash;35, in Berlin&rsquo;s scene.</p>
          <dl className="mc-st-rows">
            <div><dt className="label">They value</dt><dd className="body">Real over polished, and a crowd to belong to.</dd></div>
            <div><dt className="label">They miss</dt><dd className="body">Rock that feels made for them, not for the charts.</dd></div>
            <div><dt className="label">Where they are</dt><dd className="body">At gigs, on Instagram and Facebook, digging on Spotify, YouTube and Apple Music.</dd></div>
          </dl>
        </div>
        <div className="mc-st-card">
          <p className="label">USP</p>
          <p className="mc-st-usp">A modern grunge sound that keeps its mistakes, and a show the crowd plays in.</p>
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
                <figcaption className="label"><a href={r.href} target="_blank" rel="noreferrer">{r.credit} · edited<span className="sr-only"> (opens in a new tab)</span></a></figcaption>
              </figure>
              <p className="mc-st-name">{r.name}</p>
              <p className="body">{r.line}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mc-st-block">
        <p className="label">Voice</p>
        <p className="mc-st-rule">Talk with them, not to them.</p>
        <ul className="mc-st-habits">
          <li className="body"><b>Like old friends:</b> stories and jokes, nothing rehearsed.</li>
          <li className="body"><b>Room for everyone:</b> the pit, the side of the stage, the beer at the back.</li>
          <li className="body"><b>Make them members:</b> they picked the single and held the cameras.</li>
        </ul>
      </div>
    </section>
  );
}
