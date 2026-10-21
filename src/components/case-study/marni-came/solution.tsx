"use client";
import { useEffect, useId, useState } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MovesCanvas } from "@/components/marni-came/moves-canvas";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import { OFF, type DoubledSpec, type MoveName, type MoveState } from "@/lib/marni-came/moves";
import "./marni-came.css";

const WORDS = ["Broken", "Burned", "Doubled", "Bent", "Blown"] as const;
/** The typewriter (Liam 10-21): ms a letter typing, ms holding the word, ms a letter deleting, ms empty. */
const TYPE = 85, HOLD = 1400, DELETE = 45, GAP = 250;
const RULES: [MoveName, string, string][] = [
  ["slice", "Slice", "Bands cut and shifted: the face breaks where the heart does."],
  ["burn", "Burn", "Light eats into the black from one edge. The dark always survives."],
  ["doubled", "Doubled", "Part of the subject repeats, offset and larger, from one moment."],
  ["lens", "Lens", "The centre stays sharp; the edges smear, never evenly."],
  ["blowout", "Blowout", "The highlights blow out and bleed light, a hair of colour at the edge."],
];
// the copy grows from Liam, centre stage, and lands up and to the right
const FACE: DoubledSpec = { box: [0.42, 0.1, 0.7, 0.66], dx: 0.07, dy: -0.04, scale: 1.12 };

/** Board CS 04 · Solution: the idea (its word typed out through the five moves, "on purpose" following it; still under
 *  reduced motion), then the effects switch, the brand's five moves applied live to the Lido stage photo. */
export function MarniCameSolution({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  const [typed, setTyped] = useState<string>(WORDS[0]);
  const [moves, setMoves] = useState<MoveState>(OFF);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // type, hold, backspace, then the next word; "on purpose" sits right after the letters, so it follows them
    let w = 0, n = WORDS[0].length, deleting = false, t = 0;
    const step = () => {
      const word = WORDS[w];
      if (!deleting && n === word.length) { deleting = true; t = window.setTimeout(step, HOLD); return; }
      if (deleting && n === 0) { deleting = false; w = (w + 1) % WORDS.length; t = window.setTimeout(step, GAP); return; }
      n += deleting ? -1 : 1;
      setTyped(WORDS[w].slice(0, n));
      t = window.setTimeout(step, deleting ? DELETE : TYPE);
    };
    t = window.setTimeout(step, HOLD);
    return () => clearTimeout(t);
  }, []);
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec solution ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-idea">
        <span className="sr-only">Broken, burned, doubled, bent, blown: on purpose.</span>
        <span aria-hidden="true"><span className="mc-cyc">{typed}</span> on purpose.</span>
      </p>
      <div className="mc-two mc-pillars">
        <div><p className="label">The sound</p><p className="body">Not overproduced. We kept the mistakes, the inaccuracies and the vocals that aren&rsquo;t pitch perfect, so the record sounds like the room.</p></div>
        <div><p className="label">The crowd</p><p className="body">The audience is part of the band, not its customer.</p></div>
      </div>
      <div className="mc-switch">
        <MovesCanvas className="mc-switch-img" src={MC_ASSETS.switchPhoto} alt="Marni Came on stage at Lido, Liam with his arms up and the guitarist in front, with the chosen moves applied" burnSrc={MC_ASSETS.burnLight} doubled={FACE} state={moves} />
        <div className="mc-switch-ctl" role="group" aria-label="The five moves">
          <p className="mc-open">The brand is five moves. Try them.</p>
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
