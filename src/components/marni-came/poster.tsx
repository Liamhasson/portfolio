import { MC_ASSETS } from "@/lib/marni-came/assets";

/** How a poster sets its type (Liam 10-20: one series, not one layout). classic: the venue fitted across the foot;
 *  side: the venue running up the left edge; framed: the photo inside a black margin, the type in the margin; stacked:
 *  the venue's last word spanning the width, the rest small above it. */
export type PosterLayout = "classic" | "side" | "framed" | "stacked";

/** Width in cqw of a serif capital line `chars` long set at 1cqw (Cormorant Garamond 600 runs ~0.68 em a capital). */
const fit = (width: number, chars: number) => Math.min(36, width / (chars * 0.68));

/** One show poster in the series (board spread 12): the photo, the wordmark, the venue in red serif capitals and the
 *  date (the only place dates appear; Decision 20). */
export function Poster({ photo, venue, date, alt, layout }: { photo: string; venue: string; date: string; alt: string; layout: PosterLayout }) {
  const info = <><span>Marni Came<i>Live</i></span><span>{date}<i>Berlin</i></span></>;
  // (the type is part of the printed artwork, scaled with it; the photo's alt says what it says)
  const product = { "aria-hidden": true, "data-product": "" } as const;
  if (layout === "side") {
    // the venue fills 80% of the poster's height (141 cqw) along the left edge
    const size = fit(0.8 * 141, venue.length);
    return (
      <figure className="mc-poster" data-layout="side">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mc-poster-bg" src={photo} alt={alt} loading="lazy" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mc-poster-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="" />
        <p className="mc-poster-venue" style={{ fontSize: `${size.toFixed(2)}cqw`, translate: `${(size * 0.79).toFixed(2)}cqw 0` }} {...product}>{venue}</p>
        <p className="mc-poster-info" {...product}>{info}</p>
      </figure>
    );
  }
  if (layout === "framed") {
    return (
      <figure className="mc-poster" data-layout="framed">
        <div className="mc-poster-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mc-poster-bg" src={photo} alt={alt} loading="lazy" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mc-poster-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="" />
        <p className="mc-poster-venue" style={{ fontSize: `${fit(64, venue.length).toFixed(2)}cqw` }} {...product}>{venue}</p>
        <p className="mc-poster-info" {...product}><span>Live<i>Berlin</i></span><span>{date}</span></p>
      </figure>
    );
  }
  if (layout === "stacked") {
    const words = venue.split(" ");
    const last = words.pop() ?? venue;
    const lead = words.join(" ");
    return (
      <figure className="mc-poster" data-layout="stacked">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mc-poster-bg" src={photo} alt={alt} loading="lazy" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mc-poster-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="" />
        <p className="mc-poster-venue" {...product}>
          {lead && <span style={{ fontSize: `${fit(30, lead.length).toFixed(2)}cqw` }}>{lead}</span>}
          <span style={{ fontSize: `${fit(86, last.length).toFixed(2)}cqw` }}>{last}</span>
        </p>
        <p className="mc-poster-info" {...product}>{info}</p>
      </figure>
    );
  }
  return (
    <figure className="mc-poster" data-layout="classic">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mc-poster-bg" src={photo} alt={alt} loading="lazy" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mc-poster-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="" />
      <p className="mc-poster-venue" style={{ fontSize: `${fit(86, venue.length).toFixed(2)}cqw` }} {...product}>{venue}</p>
      <p className="mc-poster-info" {...product}>{info}</p>
    </figure>
  );
}

export const POSTERS = [
  { photo: MC_ASSETS.posters.lido, venue: "Lido", date: "12.2023", layout: "classic", alt: "Lido poster, Marni Came live, Berlin, 12.2023: the bassist on stage through the round lens, light burning in from the top" },
  { photo: MC_ASSETS.posters.badehaus24, venue: "Badehaus", date: "09.02.2024", layout: "side", alt: "Badehaus poster, Marni Came live, Berlin, 09.02.2024: Liam pointing to the crowd, light burning in from the right, the venue running up the left edge" },
  { photo: MC_ASSETS.posters.badehaus23, venue: "Badehaus", date: "02.2023", layout: "framed", alt: "Badehaus poster, Marni Came live, Berlin, 02.2023: the whole band under the stage lights, Liam with his arms up and a hand raised in the crowd, framed in black" },
  { photo: MC_ASSETS.posters.endOfTerm, venue: "End of term", date: "03.2022", layout: "stacked", alt: "End of Term poster, Marni Came live, Berlin, 03.2022: a bandmate playing at the front of the stage, Liam behind him, light burning in from below" },
] as const satisfies readonly { photo: string; venue: string; date: string; layout: PosterLayout; alt: string }[];
