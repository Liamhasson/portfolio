import Image from "next/image";

const PHONES = [
  { src: "phone-hero", alt: "The home page on a phone: Your carriers owe you, No monthly fee, the two buttons and the 3D invoice turning below them" },
  { src: "phone-breakdown", alt: "The audit breakdown on a phone: every charge listed, the duplicate charge and the address correction found, 4 findings, $117.77" },
  { src: "phone-pricing", alt: "What this costs on a phone: the delivery spend slider at $500,000 and an estimated recovery of $5,000 to $15,000" },
] as const;

/** Impact, above the link: the live site on an iPhone (393×852 at 3×, recorded 2026-10-26 with
 *  scripts/capture/nordic-logic-site.mjs), in the hero's tray. Screens, no device: the site is the subject. */
export function NordicLogicPhones() {
  return (
    // A focus stop with a name: on a phone the row scrolls sideways, and a scroll region has to be reachable by keyboard.
    <div className="phones" role="region" aria-label="The live site on a phone" tabIndex={0}>
      {PHONES.map((p) => (
        <Image key={p.src} src={`/case-studies/nordic-logic/${p.src}.jpg`} alt={p.alt} width={1179} height={2556} sizes="(min-width: 1100px) 300px, 70vw" />
      ))}
    </div>
  );
}
