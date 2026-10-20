import type { Metadata } from "next";
import { marniFonts } from "@/components/marni-came/fonts";
import { BandSite } from "@/components/marni-came/site/band-site";

/** The Marni Came band site in release week (spec 2026-10-20 §5): its own page, embedded in the case study, kept out of
 *  search. */
export const metadata: Metadata = {
  title: "Marni Came · After Heartbreaks",
  description: "Marni Came's site in the week After Heartbreaks came out.",
  robots: { index: false, follow: false },
};

export default function MarniCameSitePage() {
  return <BandSite className={marniFonts} />;
}
