"use client";
import { useId, useMemo, useState } from "react";
import { Icon } from "../icons";
import { BAND_CLASS, capacityAt, f1, rowsFor, type DangerRow } from "./danger-rows";

const GENRES = ["Rock", "Alternative", "Pop", "Electronic", "Hip hop", "Jazz", "Metal", "Folk"];
const GENRES_PHONE = ["Rock", "Alternative", "Pop", "Electronic", "Jazz"];

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:00`;

interface Controls {
  pos: number;
  genre: string;
  start: number;
  capacity: number;
  rows: DangerRow[];
  setPos: (p: number) => void;
  setGenre: (g: string) => void;
  step: (hours: number) => void;
}

/** The Danger Score as the product shows it (board frame 04), running: the controls re-score the rows through the
    product's own weights. `phone` is the board's 390 variant: short factor labels, five genres, no reasons under the
    bars, the formula under the factors. */
function Calculator({ phone = false, c }: { phone?: boolean; c: Controls }) {
  return (
    <div className={phone ? "calc app m-calc only-m" : "calc app"} data-product>
      {phone ? (
        <div className="calc-top">
          <div><div className="calc-date">Nov 18, 2026</div><div className="calc-sub">Berlin, Germany · {c.genre}</div></div>
          <span className="iconbtn" aria-hidden="true"><Icon name="share" /></span>
        </div>
      ) : (
        <div className="calc-top">
          <div><div className="calc-date">Nov 18, 2026</div><div className="calc-sub">Berlin, Germany · {c.genre}</div></div>
          <div className="calc-top-r">
            <div className="formula-k"><b>Capacity</b>×<b>Genre</b>×<b>Timing</b></div>
            <span className="badge safe">Safe</span><span className="badge threat">Threat</span><span className="badge crit">Critical</span>
            <span className="iconbtn" aria-hidden="true"><Icon name="share" /></span>
          </div>
        </div>
      )}
      <div className={phone ? undefined : "calc-body"}>
        <aside className="yours">
          <div className="app-label">Your show</div>
          <div>
            <div className="field-row"><span>Capacity</span><span className="val">{c.capacity.toLocaleString("en-US")}<span className="unit">CAP</span></span></div>
            <div className="slider">
              <div className="track" /><div className="fill" style={{ width: `${c.pos}%` }} /><div className="thumb" style={{ left: `${c.pos}%` }} />
              <input
                type="range" min={0} max={100} step={1} value={c.pos} className="slider-input"
                aria-label="Your room's capacity" aria-valuetext={`${c.capacity.toLocaleString("en-US")} capacity`}
                onChange={(e) => c.setPos(Number(e.target.value))}
              />
            </div>
            {!phone && <div className="ticks"><span>100</span><span>1,000</span><span>10,000</span></div>}
          </div>
          <div>
            <div className="field-row"><span>Genre</span></div>
            <div className="seg" role="group" aria-label="Your genre">{(phone ? GENRES_PHONE : GENRES).map((g) => <button type="button" key={g} className={g === c.genre ? "on" : undefined} aria-pressed={g === c.genre} onClick={() => c.setGenre(g)}>{g}</button>)}</div>
          </div>
          <div>
            <div className="field-row"><span>Start time</span></div>
            <div className="time">
              <button type="button" aria-label="One hour earlier" disabled={c.start <= 0} onClick={() => c.step(-1)}><Icon name="minus" /></button>
              <span aria-live="polite">{hhmm(c.start)}</span>
              <button type="button" aria-label="One hour later" disabled={c.start >= 23 * 60} onClick={() => c.step(1)}><Icon name="plus" /></button>
            </div>
            {!phone && <div className="time-help">Within 2 h: 1.0 · within 6 h: 0.7 · later: 0.3</div>}
          </div>
        </aside>
        <div className="rows">
          {c.rows.map((r) => (
            <div className="row" key={r.ev}>
              <div className="row-head">
                <div>
                  <div className="ev">{r.ev}</div>
                  <div className="meta">
                    {phone ? r.venue : `${r.venue}, Berlin`} · <span className="num">{r.cap}</span> cap · {r.genreName}
                    {!phone && <> · <span className="num">{r.time}</span></>}
                  </div>
                </div>
                <span className={`badge${phone ? "" : " lg"} ${BAND_CLASS[r.band]}`}>{r.band}</span>
              </div>
              <div className="row-f">
                {([["Capacity", "Cap", r.capacity], ["Genre", "Genre", r.genre], ["Timing", "Time", r.timing]] as const).map(([label, short, v], k) => (
                  <div key={label}>
                    <div className="fac-top"><span className="app-label">{phone ? short : label}</span><b>{f1(v)}</b></div>
                    <div className="bar"><i style={{ width: `${v * 100}%` }} /></div>
                    {!phone && <div className="why">{r.why[k]}</div>}
                  </div>
                ))}
                <div className="prod">
                  <div className="eqn">{f1(r.capacity)}<i>×</i>{f1(r.genre)}<i>×</i>{f1(r.timing)}</div>
                  <div className="res">= {(r.capacity * r.genre * r.timing).toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Board frame 04 · Solution: the Danger Score, the one navy band (eventread-mockups.html:490-577, phone 692-774). */
export function EventreadSolution({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  const [pos, setPos] = useState(50);
  const [genre, setGenre] = useState("Rock");
  const [start, setStart] = useState(20 * 60);
  const capacity = capacityAt(pos);
  const rows = useMemo(() => rowsFor({ capacity, genre, startTime: hhmm(start) }), [capacity, genre, start]);
  const c: Controls = { pos, genre, start, capacity, rows, setPos, setGenre, step: (h) => setStart((s) => Math.min(23 * 60, Math.max(0, s + h * 60))) };
  return (
    <section aria-labelledby={id} data-block={kind} className="f navy">
      <div className="g12" style={{ alignItems: "end" }}>
        <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="body" style={{ gridColumn: "8/13" }}>
          <span className="lead">The Danger Score.</span> Every competing event gets three weights: how big its room is next to yours, how close its genre is to yours, and how close its start time is to yours. Multiplied together, they place the night in one of three bands: Safe, Threat or Critical.
        </p>
      </div>
      <div className="calc-wrap only-d">
        <div className="calc-anno" aria-hidden="true"><span>Your show</span><span>Capacity × genre × timing</span><span>Band</span></div>
        <Calculator c={c} />
      </div>
      <Calculator phone c={c} />
      <p className="sr-only" aria-live="polite">{rows.map((r) => `${r.ev}: ${r.band}`).join(". ")}</p>
      <div className="g12 navy-foot">
        <div style={{ gridColumn: "1/6" }}>
          <p className="body">
            On the live product&apos;s own example, a 1,000-cap rock show in Berlin on 18 November 2026, Muse at the Uber Arena is Critical, Horse Lords in a 532-cap room is a Threat because it&apos;s the same genre, and TAEMIN at 3,638 is Safe. Change the show above and those three rows re-score with the product&apos;s own weights.
          </p>
        </div>
        <p className="display" style={{ gridColumn: "7/13" }}>Size isn&apos;t danger; <em>relevance is.</em></p>
      </div>
    </section>
  );
}
