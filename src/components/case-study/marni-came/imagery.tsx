import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

const D = MC_ASSETS.doubled;
const MOVES = [
  { name: "Burn", src: MC_ASSETS.moves.burn, alt: "Liam screaming in the After Heartbreaks video, amber film burn eating in from the left" },
  { name: "Doubled", src: MC_ASSETS.moves.doubled, alt: "The bassist at the After Heartbreaks shoot, his head echoed from the next frame of the same moment" },
  { name: "Lens", src: MC_ASSETS.moves.lens, alt: "The drummer in the After Heartbreaks video, sharp in the middle, the frame's edges smeared" },
  { name: "Blowout", src: MC_ASSETS.moves.blowout, alt: "The bassist in the After Heartbreaks video, the light on his face and the headstock blown out and bleeding", note: "On pictures only, never on type" },
] as const;
/** The moodboard: the video's own doubles (timestamps in the alt), the shoot's two-frame double and the same-frame method. */
const MOOD: { src: string; alt: string; cls?: string }[] = [
  { src: D["01"], alt: "Two band members at two sizes, the video at 1:57", cls: "w2 h2" },
  { src: MC_ASSETS.moves.doubled, alt: "The bassist doubled from two frames of the same moment, the After Heartbreaks shoot", cls: "h2" },
  { src: D["02"], alt: "The guitarist, the guitar's neck doubled, the video at 2:30" },
  { src: D["03"], alt: "The drummer tripled over the kit, the video at 1:49" },
  { src: D.sameFrame, alt: "Liam with his guitar, his head screened back over itself larger: the same frame, copied", cls: "w2" },
  { src: D["04"], alt: "Two members, one face laid over the other, the video at 0:21" },
  { src: D["05"], alt: "Two members face to face, one laid over the other, the video at 3:14" },
  { src: D["06"], alt: "Three members in one frame, the star strap in front, the video at 1:52", cls: "w2" },
  { src: D.tall, alt: "The bassist doubled, two heads and two necks offset, the video at 1:50", cls: "h2" },
  { src: D["07"], alt: "The singer and a bandmate face to face, the video at 3:11" },
  { src: D["08"], alt: "The drummer doubled over the kit, seen wide, the video at 0:21" },
  { src: D["09"], alt: "Two guitarists in the amber burn, the video at 1:48" },
  { src: D["10"], alt: "The guitarist with his strap doubled, the video at 1:56" },
];

/** The video's own burns (Liam 10-25: the section needed them), the subject still readable through the light. */
const BURNED: { src: string; alt: string }[] = [
  { src: MC_ASSETS.burned[0], alt: "Sami at the drums, the frame washed amber, his face and the cymbals burned white, the After Heartbreaks video" },
  { src: MC_ASSETS.burned[1], alt: "Liam singing, film burn flaring in from the right, the After Heartbreaks video at 1:00" },
  { src: MC_ASSETS.burned[2], alt: "Liam looking down, the burn closing in from both edges, the video at 0:35" },
  { src: MC_ASSETS.burned[3], alt: "Liam screaming beside a bandmate, a pale burn washing over half the frame, the video at 1:06" },
  { src: MC_ASSETS.burned[4], alt: "Liam's face surfacing through a deep amber burn, the video at 1:23" },
  { src: MC_ASSETS.burned[5], alt: "Liam with his guitar, a band of amber light across the frame, the video at 2:00" },
];

/** Board CS 06 · Imagery: the four moves (Blowout, the picture-only glow, joined 10-21), then Doubled as a moodboard with its rule. */
export function MarniCameImagery({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec imagery ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-headline">Real photographs and footage, <em className="mc-red">broken by hand.</em></p>
      <div className="mc-moves">
        {MOVES.map((m) => (
          <figure key={m.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.src} alt={m.alt} loading="lazy" />
            <figcaption><b>{m.name}</b>{"note" in m && <span className="label">{m.note}</span>}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mc-burned">
        {BURNED.map((b) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={b.src} src={b.src} alt={b.alt} loading="lazy" />
        ))}
      </div>
      <p className="body mc-rule">Burn is never the same twice: from one edge or several, sometimes the whole frame for a moment, then gone.</p>
      <div className="mc-mood">
        {MOOD.map((m) => (
          <div key={m.src + m.alt} className={m.cls}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.src} alt={m.alt} loading="lazy" />
          </div>
        ))}
      </div>
      <p className="body mc-rule">Doubled only ever uses one moment: two frames of the same burst in a photo, or the same frame copied in video. Never two shows, sessions or outfits.</p>
    </section>
  );
}
