import type { Metadata } from "next";
import { Teaser } from "@/components/case-study/cyvore-new/teaser";
import { cyvoreNew } from "@/content/cyvore-new";
import { pageMetadata } from "@/lib/site";

const base = pageMetadata("/cyvore-new");
const still = { url: cyvoreNew.still.src, width: cyvoreNew.still.width, height: cyvoreNew.still.height, alt: cyvoreNew.still.alt };

/** Cyvore's new website, coming soon (spec 2026-11-25): indexed; its framed snapshot is not (src/lib/headers.ts). */
export const metadata: Metadata = {
  title: "Cyvore · New website (in progress)",
  description: cyvoreNew.line,
  ...base,
  openGraph: { ...base.openGraph, images: [still] },
  twitter: { card: "summary_large_image", images: [still] },
};

export default function CyvoreNewPage() {
  return <Teaser />;
}
