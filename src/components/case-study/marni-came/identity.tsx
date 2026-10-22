import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

const COLOURS = [
  { name: "Blackout", hex: "0A0908", share: 6.5, cls: "c-black" },
  { name: "Bone", hex: "EEEAE2", share: 2.2, cls: "c-bone" },
  { name: "Red", hex: "EC1302", share: 0.6, cls: "c-red" },
  { name: "Burn", hex: "Screen", share: 1.4, cls: "c-burn" },
] as const;

/** Board CS 05 · Identity: the mark (master, burned, print, and at 64 px), the colours in proportion, the type, and the
 *  sans at work in the band's own pieces. */
export function MarniCameIdentity({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec identity ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-headline">One mark, typed in Elephant and <em className="mc-red">cut by hand.</em></p>
      <div className="mc-logos">
        <figure className="lg-master">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.wordmarkDistressedBone} alt="The Marni Came wordmark, distressed, in bone on black" />
          <figcaption className="label">Master · distressed</figcaption>
        </figure>
        <figure className="lg-burned">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.logoBurned} alt="The wordmark with amber light from the video burning in from the left" loading="lazy" />
          <figcaption className="label">Burned</figcaption>
        </figure>
        <figure className="lg-print">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.wordmarkBlack} alt="The clean wordmark in black on bone" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lg-tiny" src={MC_ASSETS.wordmarkBlack} alt="The clean wordmark at 64 pixels wide" width={64} />
          <span className="label lg-tiny-l">at 64 px</span>
          <figcaption className="label">Print · clean</figcaption>
        </figure>
      </div>
      <ul className="mc-colours" aria-label="The colours, in proportion">
        {COLOURS.map((c) => (
          <li key={c.name} className={c.cls} style={{ flex: c.share }} aria-label={c.cls === "c-burn" ? `${c.name}, light screened over the picture` : `${c.name}, ${c.hex}`}><i aria-hidden="true" /><b>{c.name}</b><span>{c.hex}</span></li>
        ))}
      </ul>
      <div className="mc-type">
        <div><p className="label">Cormorant Garamond 600 · titles</p><p className="mc-spec-serif" aria-label="The serif's capitals, A to Z">ABCDEFGHIJKLM<br />NOPQRSTUVWXYZ</p></div>
        <div><p className="label">Archivo 500 · information</p><p className="mc-spec-sans" aria-label="The sans's capitals and numerals">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />0123456789 · / — &amp;</p></div>
      </div>
      <div className="mc-work">
        <div className="wk">
          <p className="label">Credit block</p>
          <p className="sm"><i>Directed and filmed by</i> Marni Came<br /><i>Editing</i> Liam Wind Hasson<br /><i>Colour grading</i> Imri Agmon<br /><i>Mixing</i> Fabio Buemi<br /><i>Mastering</i> Nadim Khoury</p>
        </div>
        <div className="wk tk">
          <p className="label">Ticket</p>
          <dl>
            <div className="r2"><dt className="sm">Marni Came</dt><dd className="sm">Live</dd></div>
            <div className="r2"><dt className="sm">Badehaus</dt><dd className="sm">Berlin</dd></div>
            <div className="r2"><dt className="sm">09.02.2024</dt><dd className="sm">18:30</dd></div>
            <div className="r2"><dt className="sm"><i>With</i></dt><dd className="sm">Yasha 96 &amp; The Dead Actors</dd></div>
          </dl>
        </div>
        <div className="wk">
          <p className="label">Tracklist</p>
          <ol>
            <li className="r2"><span className="sm"><i>01</i> After Heartbreaks</span></li>
            <li className="r2"><span className="sm"><i>02</i> Dopamine</span></li>
            <li className="r2"><span className="sm"><i>03</i> You&rsquo;ll Be You</span></li>
          </ol>
        </div>
      </div>
    </section>
  );
}
