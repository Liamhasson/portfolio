import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

const D = MC_ASSETS.doubled;
const B = MC_ASSETS.burned;
/** The twelve strongest pictures, mixed, each tagged with the move it shows (Liam 10-25: fewer, better, all four moves).
 *  `cls` sets the bento: w2 spans two columns, h2 two rows. */
const GRID: { src: string; move: string; alt: string; cls?: string }[] = [
  { src: MC_ASSETS.moves.burn, move: "Burn", alt: "Liam screaming, amber film burn eating in from the left, the After Heartbreaks video's thumbnail", cls: "w2 h2" },
  { src: MC_ASSETS.moves.doubled, move: "Doubled", alt: "The bassist at the After Heartbreaks shoot, his head echoed from the next frame of the same moment", cls: "h2" },
  { src: B[0], move: "Burn", alt: "Sami at the drums, the frame washed amber, his face and the cymbals burned white, the After Heartbreaks video" },
  { src: D["02"], move: "Doubled", alt: "The guitarist, the guitar's neck doubled, the video at 2:30" },
  { src: MC_ASSETS.moves.lens, move: "Lens", alt: "The drummer, sharp in the middle, the frame's edges smeared, the After Heartbreaks video", cls: "w2" },
  { src: MC_ASSETS.moves.blowout, move: "Blowout", alt: "The bassist, the light on his face and the headstock blown out and bleeding, the After Heartbreaks video" },
  { src: D.tall, move: "Doubled", alt: "The bassist doubled, two heads and two necks offset, the video at 1:50", cls: "h2" },
  { src: B[1], move: "Burn", alt: "Liam singing, film burn flaring in from the right, the After Heartbreaks video at 1:00", cls: "w2" },
  { src: D["07"], move: "Doubled", alt: "The singer and a bandmate face to face, one laid over the other, the video at 3:11" },
  { src: D["03"], move: "Lens", alt: "The drummer over the kit, the edges of the frame smeared, the video at 1:49" },
  { src: B[6], move: "Burn", alt: "Sami at the drums in profile, film burn flaring in from the right, the After Heartbreaks video at 1:25", cls: "w2" },
  { src: D.sameFrame, move: "Blowout", alt: "Liam with his guitar, the light behind his head blown out, the same frame screened back over itself" },
];

/** Board CS 06 · Imagery: one mixed grid of the brand's best pictures, each tagged with its move, then the rules. */
export function MarniCameImagery({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec imagery ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-headline">Real photographs and footage. <em className="mc-red">Burned, doubled, never staged.</em></p>
      <div className="mc-grid">
        {GRID.map((g) => (
          <figure key={g.src} className={g.cls}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt={g.alt} loading="lazy" />
            <figcaption className="label">{g.move}</figcaption>
          </figure>
        ))}
      </div>
      <p className="body mc-rule">Burn is never the same twice. Doubled only ever uses one moment, never two shows or sessions. Blowout lives on pictures only, never on type.</p>
    </section>
  );
}
