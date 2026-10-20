"use client";
import { useEffect, useId, useState } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MovesCanvas } from "@/components/marni-came/moves-canvas";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import { OFF, type DoubledSpec, type MoveName, type MoveState } from "@/lib/marni-came/moves";
import "./marni-came.css";

const WORDS = ["Broken", "Burned", "Doubled", "Bent"] as const;
const RULES: [MoveName, string, string][] = [
  ["slice", "Slice", "Bands cut and shifted: the face breaks where the heart does."],
  ["burn", "Burn", "Light eats into the black from one edge. The dark always survives."],
  ["doubled", "Doubled", "Part of the subject repeats, offset and larger, from one moment."],
  ["lens", "Lens", "The edges bend, like a wide lens up close."],
];
// the copy grows from Liam, centre stage, and lands up and to the right
const FACE: DoubledSpec = { box: [0.42, 0.1, 0.7, 0.66], dx: 0.07, dy: -0.04, scale: 1.12 };

/** Board CS 04 · Solution: the idea (its word cycling through the four moves every 1.6 s, each arriving with its own move,
 *  "on purpose" following it; still under reduced motion), then the effects switch, the brand's four moves applied live to
 *  the Lido stage photo. */
export function MarniCameSolution({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  const [word, setWord] = useState(0);
  const [moves, setMoves] = useState<MoveState>(OFF);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec solution ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-idea">
        <span className="sr-only">Broken, burned, doubled, bent: on purpose.</span>
        <span aria-hidden="true"><span key={word} className="mc-cyc" data-word={WORDS[word]} data-fx={WORDS[word].toLowerCase()}>{WORDS[word]}</span> on purpose.</span>
      </p>
      <div className="mc-two mc-pillars">
        <div><p className="label">The sound</p><p className="body">Not overproduced. We kept the mistakes, the inaccuracies and the vocals that aren&rsquo;t pitch perfect, so the record sounds like the room.</p></div>
        <div><p className="label">The crowd</p><p className="body">The audience is part of the band, not its customer.</p></div>
      </div>
      <div className="mc-switch">
        <MovesCanvas className="mc-switch-img" src={MC_ASSETS.switchPhoto} alt="Marni Came on stage at Lido, Liam with his arms up and the guitarist in front, with the chosen moves applied" burnSrc={MC_ASSETS.burnLight} doubled={FACE} state={moves} />
        <div className="mc-switch-ctl" role="group" aria-label="The four moves">
          <p className="mc-open">The brand is four moves. Try them.</p>
          {RULES.map(([m, name, rule]) => (
            <button key={m} type="button" className="mc-move" aria-pressed={moves[m] === 1} onClick={() => setMoves((s) => ({ ...s, [m]: s[m] === 1 ? 0 : 1 }))}>
              <b>{name}</b><span>{rule}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
