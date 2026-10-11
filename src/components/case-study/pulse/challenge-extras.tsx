import Image from "next/image";

/** Board frame 06: how many testers it was, and each challenge's final screen. */
const EXTRAS = [
  { chips: [["4 of 6", "testers"]], shot: { src: "/case-studies/pulse/training-log.jpg", alt: "The Training Log that replaced it", height: 1280 } },
  { chips: [["5 of 6", "testers"]], shot: { src: "/case-studies/pulse/onb-02.jpg", alt: "Onboarding: What brings you here? Pick the goals that matter most", height: 1280 } },
  { chips: [["4 of 6", "testers"], ["6 of 6", "in round 2"]], shot: { src: "/case-studies/pulse/challenges.jpg", alt: "Challenges, private and progress-based", height: 1278 } },
] as const;

export function PulseChallengeExtras({ index }: { index: number }) {
  const e = EXTRAS[index];
  return (
    <>
      <div className="ch-chips">
        {e.chips.map(([n, rest]) => <span key={n + rest} className="chip"><b>{n}</b> {rest}</span>)}
      </div>
      <div className="ch-shot">
        <Image src={e.shot.src} alt={e.shot.alt} width={590} height={e.shot.height} sizes="(min-width: 1100px) 240px, 60vw" />
      </div>
    </>
  );
}
