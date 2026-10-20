import { MC_ASSETS } from "@/lib/marni-came/assets";

/** One show poster in the series (board spread 12): the photo, the wordmark, the venue in red serif capitals fitted to
 *  the poster's width, and the date (the only place dates appear; Decision 20). */
export function Poster({ photo, venue, date, alt }: { photo: string; venue: string; date: string; alt: string }) {
  // the venue fills 86% of the width at the serif's ~0.68 em per capital, never taller than 36% of the width
  const size = Math.min(36, 86 / (venue.length * 0.68));
  return (
    <figure className="mc-poster">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mc-poster-bg" src={photo} alt={alt} loading="lazy" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mc-poster-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="" />
      {/* (the type is part of the printed artwork, scaled with it; the photo's alt says what it says) */}
      <p className="mc-poster-venue" style={{ fontSize: `${size.toFixed(2)}cqw` }} aria-hidden="true" data-product="">{venue}</p>
      <p className="mc-poster-info" aria-hidden="true" data-product=""><span>Marni Came<i>Live</i></span><span>{date}<i>Berlin</i></span></p>
    </figure>
  );
}

export const POSTERS = [
  { photo: MC_ASSETS.posters.lido, venue: "Lido", date: "12.2023", alt: "Lido poster, Marni Came live, Berlin, 12.2023: the bassist on stage through the round lens, light burning in from the top" },
  { photo: MC_ASSETS.posters.badehaus24, venue: "Badehaus", date: "09.02.2024", alt: "Badehaus poster, Marni Came live, Berlin, 09.02.2024: Liam pointing to the crowd, light burning in from the right" },
  { photo: MC_ASSETS.posters.badehaus23, venue: "Badehaus", date: "02.2023", alt: "Badehaus poster, Marni Came live, Berlin, 02.2023: Liam singing, light burning in from the left" },
  { photo: MC_ASSETS.posters.endOfTerm, venue: "End of term", date: "03.2022", alt: "End of Term poster, Marni Came live, Berlin, 03.2022: Liam at the microphone in stage haze, light burning in from below" },
] as const;
