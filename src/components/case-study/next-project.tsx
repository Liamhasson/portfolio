import Image from "next/image";
import Link from "next/link";
import { cyvore } from "@/content/case-studies/cyvore";
import { eventread } from "@/content/case-studies/eventread";
import { nordicLogic } from "@/content/case-studies/nordic-logic";
import { pulse } from "@/content/case-studies/pulse";
import type { CaseSlug, CaseStudy } from "@/lib/case-studies/types";
import { nextProject } from "@/lib/projects";
import { Icon } from "./icons";

const STUDIES: Record<CaseSlug, CaseStudy> = { eventread, cyvore, pulse, "nordic-logic": nordicLogic };
/** Each board styles the next study peeking in under its own prefix: er-, cy-, pu-, nl-. */
const PEEK: Record<CaseSlug, { p: string; frame: string }> = {
  eventread: { p: "er", frame: "er-frame" },
  cyvore: { p: "cy", frame: "cy-frame" },
  pulse: { p: "pu", frame: "pu-phone" },
  "nordic-logic": { p: "nl", frame: "nl-frame" },
};

/** Board frame 08 · Next project: the next study peeks in, in its own world. */
export function NextProject({ from }: { from: CaseSlug }) {
  const next = STUDIES[nextProject(from).slug as CaseSlug];
  const { p, frame } = PEEK[next.slug];
  return (
    <nav aria-label="Next case study" className="f next">
      <Link href={`/${next.slug}`} aria-label={`Next project: ${next.title}`} className={p}>
        <div className={`${p}-text`}>
          <div className={`${p}-next`}>Next project<i aria-hidden="true" /><Icon name="arrow-right" /></div>
          <div className={`${p}-title`}>{next.title}</div>
          <p className={`${p}-line`}>{next.line}</p>
        </div>
        <div className={frame}>
          <Image src={next.peek.src} alt={next.peek.alt} width={next.peek.width} height={next.peek.height} sizes="(min-width: 1100px) 52vw, 100vw" />
        </div>
      </Link>
    </nav>
  );
}
