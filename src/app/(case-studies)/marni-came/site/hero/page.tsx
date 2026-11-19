import type { Metadata } from "next";
import { marniFonts } from "@/components/marni-came/fonts";
import { BandSite } from "@/components/marni-came/site/band-site";

/** The band site's first screen alone, the case study's embed (Liam, 2026-11-19: only the hero, no scrolling through the
 *  whole site). Kept out of search like the site. */
export const metadata: Metadata = {
  title: "Marni Came · After Heartbreaks",
  description: "The first screen of Marni Came's site in the week After Heartbreaks came out.",
  robots: { index: false, follow: false },
};

export default function MarniCameSiteHeroPage() {
  return <BandSite heroOnly className={marniFonts} />;
}
