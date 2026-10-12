import type { Metadata } from "next";
import type { CaseStudy } from "@/lib/case-studies/types";

/** The site's address (Liam, 2026-10-12: liamhasson.com). Link previews, the sitemap and canonical URLs build on it. */
export const SITE_URL = "https://liamhasson.com";

/** Every page, in the order a visitor meets them. */
export const PAGES = ["/", "/eventread", "/cyvore", "/pulse", "/about", "/contact"] as const;

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Liam Hasson | Product Designer", template: "%s | Liam Hasson" },
  description: "Product designer who researches, prototypes and ships products people trust.",
  alternates: { canonical: "/" },
  // (the preview image itself: app/opengraph-image.jpg and twitter-image.jpg, picked up by Next)
  openGraph: { siteName: "Liam Hasson", type: "website", locale: "en_US", url: "/" },
  twitter: { card: "summary_large_image" },
};

/** A case study's metadata: its title and line, its own address, and its peek as the shared picture. */
export function caseStudyMetadata(study: CaseStudy): Metadata {
  return {
    title: `${study.title} case study`,
    description: study.line,
    alternates: { canonical: `/${study.slug}` },
    openGraph: { url: `/${study.slug}`, images: [{ url: study.peek.src, width: study.peek.width, height: study.peek.height, alt: study.peek.alt }] },
  };
}
