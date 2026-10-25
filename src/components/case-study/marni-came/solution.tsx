"use client";
import { useId, useState } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MovesCanvas } from "@/components/marni-came/moves-canvas";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import { OFF, type DoubledSpec, type MoveName, type MoveState } from "@/lib/marni-came/moves";
import "./marni-came.css";

const RULES: [MoveName, string, string][] = [
  ["burn", "Burn", "Film burn eats into the picture, never the same way twice."],
  ["doubled", "Doubled", "One subject in the frame repeats, offset and larger, the rest stays single."],
  ["lens", "Lens", "The centre stays sharp; the edges smear, never evenly."],
  ["blowout", "Blowout", "The highlights blow out and bleed light, a hair of colour at the edge."],
];
// only Liam doubles (the mask), the band stays single: his copy, a little larger, lands up and to the left
const FACE: DoubledSpec = { box: [0.4, 0.1, 0.62, 0.9], dx: -0.09, dy: -0.03, scale: 1.1 };

/** Board CS 04 · Solution: the idea in one still line (Liam 10-22: no animation; the switch shows the moves), then the
 *  effects switch, the brand's four moves applied live to the Lido stage photo. */
export function MarniCameSolution({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  const [moves, setMoves] = useState<MoveState>(OFF);
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec solution ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-headline mc-idea">Nothing polished. <em className="mc-red">Broken on purpose.</em></p>
      <div className="mc-two mc-pillars">
        <div><p className="label">The sound</p><p className="body">Not overproduced. We kept the mistakes, the inaccuracies and the vocals that aren&rsquo;t pitch perfect, so the record sounds like the room.</p></div>
        <div><p className="label">The crowd</p><p className="body">The audience is part of the band, not its customer.</p></div>
      </div>
      <div className="mc-switch">
        <MovesCanvas className="mc-switch-img" src={MC_ASSETS.switchPhoto} alt="Marni Came on stage at Lido, Liam with his arms up and the guitarist in front, with the chosen moves applied" burnSrcs={MC_ASSETS.burns} doubled={FACE} state={moves} />
        <div className="mc-switch-ctl" role="group" aria-label="The four moves">
          <p className="mc-open">The brand is four moves. Try them.</p>
          <div className="mc-move-grid">
            {RULES.map(([m, name, rule]) => (
              <button key={m} type="button" className="mc-move" aria-pressed={moves[m] === 1} onClick={() => setMoves((s) => ({ ...s, [m]: s[m] === 1 ? 0 : 1 }))}>
                <span className="mc-move-top"><b>{name}</b><i aria-hidden="true" /></span>
                <span className="mc-move-rule">{rule}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
