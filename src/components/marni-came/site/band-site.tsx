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
        <div className="rel-burn" aria-hidden="true" />
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
            <img src={MC_ASSETS.wordmarkDistressedBone} alt="The crowd shirt's front: the wordmark in bone on black" />
            <figcaption className="ms-k">Crowd shirt · front · artwork</figcaption>
          </figure>
          <figure className="ms-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MC_ASSETS.logoBurned} alt="The stage flag: the wordmark on black cloth, light burning in from the left" className="ms-fill" />
            <figcaption className="ms-k">Stage flag · artwork</figcaption>
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

function Track({ id, n, ctrl }: { id: TrackId; n: number; ctrl: AudioController | null }) {
  const st = useSyncExternalStore(ctrl?.subscribe ?? noop, () => ctrl?.state() ?? null, () => null);
  const on = !!st?.on && st.track === id;
  const [peaks, setPeaks] = useState<{ duration: number; peaks: number[] } | null>(null);
  useEffect(() => {
    let gone = false;
    fetch(TRACKS[id].peaks).then((r) => r.json()).then((d) => { if (!gone) setPeaks(d); }).catch(() => {});
    return () => { gone = true; };
  }, [id]);
  const dur = peaks ? `${Math.floor(peaks.duration / 60)}:${String(Math.round(peaks.duration % 60)).padStart(2, "0")}` : "";
  return (
    <li className={`ms-track${on ? " on" : ""}`}>
      <button type="button" aria-pressed={on} onClick={() => (on ? ctrl?.pause() : ctrl?.play(id))}>
        <span className="ms-k">{String(n).padStart(2, "0")}</span>
        <span className="ms-t">{TRACKS[id].title}</span>
        <span className="ms-wave" aria-hidden="true">{peaks?.peaks.filter((_, i) => i % 2 === 0).map((p, i) => <i key={i} style={{ height: `${Math.max(8, p * 100)}%` }} />)}</span>
        <span className="ms-k">{dur} {on ? "❚❚" : "▶"}</span>
      </button>
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
