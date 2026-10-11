import { useId } from "react";
import { Icon } from "../icons";
import { BAND_CLASS, DANGER_ROWS, f1 } from "./danger-rows";

const GENRES = ["Rock", "Alternative", "Pop", "Electronic", "Hip hop", "Jazz", "Metal", "Folk"];
const GENRES_PHONE = ["Rock", "Alternative", "Pop", "Electronic", "Jazz"];

/** The Danger Score as the product shows it (board frame 04). `phone` is the board's 390 variant: short factor
    labels, five genres, no reasons under the bars, the formula under the factors. */
function Calculator({ phone = false }: { phone?: boolean }) {
  return (
    <div className={phone ? "calc app m-calc only-m" : "calc app"} data-product>
      {phone ? (
        <div className="calc-top">
          <div><div className="calc-date">Nov 18, 2026</div><div className="calc-sub">Berlin, Germany · Rock</div></div>
          <span className="iconbtn" aria-hidden="true"><Icon name="share" /></span>
        </div>
      ) : (
        <div className="calc-top">
          <div><div className="calc-date">Nov 18, 2026</div><div className="calc-sub">Berlin, Germany · Rock</div></div>
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
            <div className="field-row"><span>Capacity</span><span className="val">1,000<span className="unit">CAP</span></span></div>
            <div className="slider" aria-hidden="true">
              <div className="track" /><div className="fill" /><div className="thumb" />
              {!phone && (
                <svg className="cursor" style={{ left: "calc(50% + calc(var(--u) * 2))", top: "calc(var(--u) * 12)" }} viewBox="0 0 22 22" aria-hidden="true">
                  <path d="M4 2l13 8.2-6 1.3 3.6 6.6-2.4 1.3-3.6-6.6L4 17z" fill="#1a1a2e" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {!phone && <div className="ticks"><span>100</span><span>1,000</span><span>10,000</span></div>}
          </div>
          <div>
            <div className="field-row"><span>Genre</span></div>
            <div className="seg">{(phone ? GENRES_PHONE : GENRES).map((g) => <span key={g} className={g === "Rock" ? "on" : undefined}>{g}</span>)}</div>
          </div>
          <div>
            <div className="field-row"><span>Start time</span></div>
            <div className="time"><b><Icon name="minus" /></b><span>20:00</span><b><Icon name="plus" /></b></div>
            {!phone && <div className="time-help">Within 2 h: 1.0 · within 6 h: 0.7 · later: 0.3</div>}
          </div>
        </aside>
        <div className="rows">
          {DANGER_ROWS.map((r) => (
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
        <Calculator />
      </div>
      <Calculator phone />
      <div className="g12 navy-foot">
        <p className="body" style={{ gridColumn: "1/6" }}>
          On the live product&apos;s own example, a 1,000-cap rock show in Berlin on 18 November 2026, Muse at the Uber Arena is Critical, Horse Lords in a 532-cap room is a Threat because it&apos;s the same genre, and TAEMIN at 3,638 is Safe.
        </p>
        <p className="display" style={{ gridColumn: "7/13" }}>Size isn&apos;t danger; <em>relevance is.</em></p>
      </div>
    </section>
  );
}
