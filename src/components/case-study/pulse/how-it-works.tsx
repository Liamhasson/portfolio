import Image from "next/image";
import { useId } from "react";
import { LazyVideo } from "../lazy-video";

/** Board frame 05 · How it works: overview, reflect, progress, then the brand as one strip (pulse-mockups.html:444-469). */
export function PulseHowItWorks({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f how">
        <div className="g12" style={{ alignItems: "end" }}>
          <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="body" style={{ gridColumn: "8/13" }}><span className="lead">Challenges without pressure.</span> Overview, reflect, progress: a Training Log for how sessions felt, and Challenges that are private, progress-based and unlimited.</p>
        </div>
        <div className="trio">
          <div className="glow" aria-hidden="true" style={{ width: "calc(var(--u) * 1000)", height: "calc(var(--u) * 700)", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}></div>
          <figure><div className="phone"><div className="phone-screen"><Image src="/case-studies/pulse/training-log.jpg" alt="Training Log: weekly goal, current focus, most booked activities and trainers" width={590} height={1280} sizes="(min-width: 1100px) 300px, 60vw" /></div></div><figcaption className="label">Training Log</figcaption></figure>
          <figure><div className="phone"><div className="phone-screen"><Image src="/case-studies/pulse/challenges.jpg" alt="Challenges: Strength Development in progress, and challenges to browse" width={590} height={1278} sizes="(min-width: 1100px) 300px, 60vw" /></div></div><figcaption className="label">Challenges</figcaption></figure>
          <figure><div className="phone"><div className="phone-screen"><LazyVideo src="/case-studies/pulse/challenge-done.mp4" poster="/case-studies/pulse/challenge-done-poster.jpg" label="Challenge completed: you crushed the Strength Development challenge" /></div></div><figcaption className="label">A challenge completed</figcaption></figure>
        </div>
        <div className="g12" style={{ marginTop: "calc(var(--u) * 72)" }}>
          <p className="body" style={{ gridColumn: "1/7" }}>The brand carries the same promise: you set the goal, the app shows the way.</p>
        </div>
        <div className="brand">
          <div className="b-logo"><Image src="/case-studies/pulse/logo.svg" alt="Pulse logo" width={96} height={96} unoptimized /></div>
          <div className="b-icon"><Image src="/case-studies/pulse/app-icon.jpg" alt="Pulse app icon" width={700} height={542} sizes="(min-width: 1100px) 300px, 100vw" /></div>
          <div className="b-board"><Image src="/case-studies/pulse/billboard.jpg" alt="Pulse billboard: You set the goal, we show the way" width={1600} height={1066} sizes="(min-width: 1100px) 46vw, 100vw" /></div>
        </div>
      </section>
  );
}
