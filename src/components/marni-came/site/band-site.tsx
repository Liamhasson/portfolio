"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LazyVideo } from "@/components/case-study/lazy-video";
import { POSTERS, Poster } from "@/components/marni-came/poster";
import { SoundToggle } from "@/components/marni-came/sound-toggle";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import { TRACKS, createAudioController, createRemoteController, isEmbedded, type AudioController, type TrackId } from "@/lib/marni-came/audio";
import "./band-site.css";

const noop = () => () => {};
const NAV = [["music", "Music"], ["videos", "Videos"], ["shows", "Shows"], ["merch", "Merch"], ["band", "Band"]] as const;
/** The four of you in 'b&w clothes 2', left to right, and where each stands across the photo (Liam, 2026-10-20). */
const BAND = [["Pedro", 18], ["Sami", 39], ["Liam", 62], ["Rikki", 84]] as const;
/** Every show the band played, newest first, from the band's own list (Liam, 2026-10-20). Club Gretchen was the BIMM End of
 *  Term show. */
const SHOWS = [
  ["09.02.2024", "Badehaus", ""],
  ["07.12.2023", "Lido", ""],
  ["20.07.2023", "Marie Antoinette", ""],
  ["01.06.2023", "Privat Club", "Emergenza Festival"],
  ["03.05.2023", "Panke Culture", ""],
  ["09.03.2023", "Cassiopeia", "Emergenza Festival"],
  ["09.02.2023", "Badehaus", "Out Of The Rabbit Hole"],
  ["14.12.2022", "Festsaal Kreuzberg", ""],
  ["17.03.2022", "Club Gretchen", "BIMM End of Term"],
] as const;
const VIDEOS = [
  { title: "After Heartbreaks", kind: "Music video", src: MC_ASSETS.releaseVideo, poster: MC_ASSETS.releaseVideoPoster },
  { title: "Dopamine", kind: "Live at Badehaus", src: MC_ASSETS.dopamineVideo, poster: MC_ASSETS.dopamineVideoPoster },
] as const;

/** The band's own site in the week After Heartbreaks came out (spec §5; board Part 3). Inside the case study it runs in an
 *  iframe and hands its sound to the page; opened on its own, it plays itself. */
export function BandSite({ className }: { className?: string }) {
  const embedded = useSyncExternalStore(noop, () => isEmbedded(window), () => false);
  const [ctrl, setCtrl] = useState<AudioController | null>(null);
  useEffect(() => {
    const c = isEmbedded(window) ? createRemoteController(window) : createAudioController(window);
    setCtrl(c); // eslint-disable-line react-hooks/set-state-in-effect -- the controller needs the browser
    return () => c.dispose();
  }, []);
  const [video, setVideo] = useState<{ src: string; title: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => { setMenu(false); menuBtn.current?.focus(); }, []);
  const closeVideo = useCallback(() => setVideo(null), []);

  return (
    <article data-world="marni-came" className={`ms ${className ?? ""}`}>
      <header className="ms-nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="#top" className="ms-mark"><img src={MC_ASSETS.wordmarkDistressedBone} alt="Marni Came" /></a>
        <nav aria-label="Sections" className="ms-links">{NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
        {ctrl && !embedded && <SoundToggle ctrl={ctrl} className="ms-sound" />}
        <button type="button" className="ms-menu-b" ref={menuBtn} aria-expanded={menu} aria-haspopup="dialog" onClick={() => setMenu(true)}>Menu</button>
      </header>
      <SiteMenu open={menu} onClose={closeMenu} ctrl={ctrl} embedded={embedded} />

      <section id="top" className="ms-hero" aria-label="New single">
        <LazyVideo className="rel-video" src={MC_ASSETS.releaseLoop} poster={MC_ASSETS.releasePoster} label="A loop from the After Heartbreaks music video" />
        {/* the burn: film-burn footage moving on its own, screened over the loop (Liam 10-22: never the same twice) */}
        <LazyVideo className="rel-burn" src={MC_ASSETS.burnLoop} poster={MC_ASSETS.burns[2]} label="" />
        <div className="rel-copy">
          <p className="ms-k">New single · out now</p>
          <h1 className="rel-title">After Heartbreaks</h1>
          <div className="rel-buttons">
            <button type="button" className="ms-btn" onClick={() => { ctrl?.pause(); setVideo(VIDEOS[0]); }}>Watch the video ↗</button>
            <button type="button" className="ms-btn" onClick={() => ctrl?.play("after-heartbreaks")}>Listen</button>
          </div>
        </div>
      </section>

      <section id="music" className="ms-sec" aria-labelledby="ms-music"><h2 id="ms-music" className="ms-h">Music</h2>
        <ol className="ms-tracks">{(Object.keys(TRACKS) as TrackId[]).map((id, i) => <Track key={id} id={id} n={i + 1} ctrl={ctrl} />)}</ol>
      </section>

      <section id="videos" className="ms-sec" aria-labelledby="ms-videos"><h2 id="ms-videos" className="ms-h">Videos</h2>
        <div className="ms-videos">{VIDEOS.map((v) => (
          <button key={v.title} type="button" className="ms-video" onClick={() => { ctrl?.pause(); setVideo(v); }} aria-label={`Play ${v.title}, ${v.kind}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.poster} alt="" loading="lazy" />
            <span className="ms-cap"><span className="ms-t">{v.title}</span><span className="ms-k">{v.kind} ▶</span></span>
          </button>
        ))}</div>
      </section>

      <section id="shows" className="ms-sec" aria-labelledby="ms-shows"><h2 id="ms-shows" className="ms-h">Shows</h2>
        <div className="ms-shows">
          <ul className="ms-list">{SHOWS.map(([d, v, note]) => (
            <li key={d}><time>{d}</time><span>{v}{note && <em>{note}</em>}</span><i>Berlin</i></li>
          ))}</ul>
          <div className="ms-posters">{POSTERS.map((p) => <Poster key={p.photo} {...p} />)}</div>
        </div>
      </section>

      <section id="merch" className="ms-sec" aria-labelledby="ms-merch"><h2 id="ms-merch" className="ms-h">Merch</h2>
        <div className="ms-merch">
          <figure className="ms-art ms-shirt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MC_ASSETS.shirtFaces} alt="The shirt with the single's cut faces printed large" className="ms-fill" />
            <figcaption className="ms-k">Shirt · After Heartbreaks release</figcaption>
          </figure>
          <figure className="ms-art ms-shirt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MC_ASSETS.shirtWordmark} alt="The shirt with the small Marni Came wordmark on the chest" className="ms-fill" />
            <figcaption className="ms-k">Shirt · Wordmark</figcaption>
          </figure>
          <figure className="ms-art ms-flag">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MC_ASSETS.flag} alt="The stage flag: the distressed wordmark in bone on cloth that burns from amber at the left to black at the right, hung by brass grommets" className="ms-fill" />
            <figcaption className="ms-k">Stage flag</figcaption>
          </figure>
        </div>
      </section>

      <section id="band" className="ms-sec" aria-labelledby="ms-band"><h2 id="ms-band" className="ms-h">Band</h2>
        <figure className="ms-group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.bandGroup} alt="Pedro, Sami, Liam and Rikki, left to right, in black and white" loading="lazy" />
          <figcaption className="ms-names">{BAND.map(([name, x]) => <span key={name} className="ms-t" style={{ left: `${x}%` }}>{name}</span>)}</figcaption>
        </figure>
      </section>

      <footer className="ms-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MC_ASSETS.wordmarkDistressedBone} alt="Marni Came" /><span className="ms-k">Berlin</span>
      </footer>

      {video && <Lightbox video={video} onClose={closeVideo} ctrl={ctrl} />}
    </article>
  );
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** One track, SoundCloud-style (Liam 10-21): a round play button, the title and time, and the waveform: it fills as the
 *  track plays, shows where a click would land, and a click (or the arrow keys) jumps there and plays. */
function Track({ id, n, ctrl }: { id: TrackId; n: number; ctrl: AudioController | null }) {
  const st = useSyncExternalStore(ctrl?.subscribe ?? noop, () => ctrl?.state() ?? null, () => null);
  const current = st?.track === id;
  const on = !!st?.on && current;
  const [peaks, setPeaks] = useState<{ duration: number; peaks: number[] } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    let gone = false;
    fetch(TRACKS[id].peaks).then((r) => r.json()).then((d) => { if (!gone) setPeaks(d); }).catch(() => {});
    return () => { gone = true; };
  }, [id]);
  const total = (current && st?.duration) || peaks?.duration || 0;
  const time = current ? st?.time ?? 0 : 0;
  const played = total ? Math.min(1, time / total) : 0;
  const bars = peaks?.peaks ?? [];
  const at = (e: { clientX: number; currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const key = (e: { key: string; preventDefault(): void }) => {
    if (!total || !ctrl) return;
    const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    ctrl.seek(id, Math.min(1, Math.max(0, (time + step) / total)));
  };
  return (
    <li className={`ms-track${on ? " on" : ""}`}>
      <button type="button" className="ms-play" aria-label={`${on ? "Pause" : "Play"} ${TRACKS[id].title}`} aria-pressed={on} onClick={() => (on ? ctrl?.pause() : ctrl?.play(id))}>
        <span aria-hidden="true" className={on ? "ms-ico-pause" : "ms-ico-play"} />
      </button>
      <div className="ms-tmeta"><span className="ms-k">{String(n).padStart(2, "0")}</span><span className="ms-t">{TRACKS[id].title}</span></div>
      <div className="ms-wave" role="slider" tabIndex={0} aria-label={`Seek in ${TRACKS[id].title}`} aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(time)} aria-valuetext={`${clock(time)} of ${clock(total)}`}
        onClick={(e) => ctrl?.seek(id, at(e))} onMouseMove={(e) => setHover(at(e))} onMouseLeave={() => setHover(null)} onKeyDown={key}>
        {bars.map((p, i) => {
          const x = (i + 0.5) / bars.length;
          return <i key={i} data-s={x <= played ? "played" : hover !== null && x <= hover ? "hover" : undefined} style={{ height: `${Math.max(10, p * 100)}%` }} />;
        })}
        {hover !== null && total > 0 && <span className="ms-wave-tip" style={{ left: `${hover * 100}%` }}>{clock(hover * total)}</span>}
      </div>
      <span className="ms-time">{current && time > 0 ? `${clock(time)} / ` : ""}{total ? clock(total) : ""}</span>
    </li>
  );
}

/** The site's phone menu: a native modal dialog (focus moves in, Escape closes, the page behind is inert). */
function SiteMenu({ open, onClose, ctrl, embedded }: { open: boolean; onClose: () => void; ctrl: AudioController | null; embedded: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    const close = () => onClose();
    d.addEventListener("close", close);
    return () => d.removeEventListener("close", close);
  }, [onClose]);
  return (
    <dialog ref={ref} aria-label="Menu" className="ms-menu">
      <div className="ms-menu-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MC_ASSETS.wordmarkDistressedBone} alt="" />
        <button type="button" onClick={() => ref.current?.close()}>Close</button>
      </div>
      {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => ref.current?.close()}>{label}</a>)}
      {ctrl && !embedded && <SoundToggle ctrl={ctrl} className="ms-sound" />}
    </dialog>
  );
}

/** A full video in a modal. It counts as the page's sound too: it pauses the moment the music is turned on, and when the
 *  tab is hidden; playing it pauses the music. */
function Lightbox({ video, onClose, ctrl }: { video: { src: string; title: string }; onClose: () => void; ctrl: AudioController | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (!d.open) d.showModal();
    const close = () => onClose();
    d.addEventListener("close", close);
    return () => d.removeEventListener("close", close);
  }, [onClose]);
  useEffect(() => {
    const pauseIfMusic = () => { if (ctrl?.state().on) vid.current?.pause(); };
    const off = ctrl?.subscribe(pauseIfMusic);
    const onVis = () => { if (document.visibilityState === "hidden") vid.current?.pause(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { off?.(); document.removeEventListener("visibilitychange", onVis); };
  }, [ctrl]);
  return (
    <dialog ref={ref} className="ms-lightbox" aria-label={video.title}>
      <button type="button" className="ms-btn" onClick={() => ref.current?.close()}>Close</button>
      <video ref={vid} src={video.src} controls autoPlay playsInline onPlay={() => { if (ctrl?.state().on) ctrl.pause(); }} />
    </dialog>
  );
}
