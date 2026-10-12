import type { Metadata } from "next";
import type { CaseStudy } from "@/lib/case-studies/types";

/** The site's address (Liam, 2026-10-12: liamhasson.com). Link previews, the sitemap and canonical URLs build on it. */
export const SITE_URL = "https://liamhasson.com";

/** Every page, in the order a visitor meets them. */
export const PAGES = ["/", "/eventread", "/cyvore", "/pulse", "/about", "/contact"] as const;

/** The site's link preview (app/opengraph-image.jpg, twitter-image.jpg). Next replaces a parent's openGraph and twitter
 *  whole when a page sets its own, so every page that does spreads these in (final review, 2026-10-12). */
const PREVIEW = { url: "/opengraph-image.jpg", width: 1200, height: 630, alt: "Liam Hasson, Product Designer: a ball of rose-gold sand" };
export const OG_BASE = { siteName: "Liam Hasson", type: "website", locale: "en_US", images: [PREVIEW] } satisfies NonNullable<Metadata["openGraph"]>;
export const TWITTER_BASE: NonNullable<Metadata["twitter"]> = { card: "summary_large_image", images: [{ ...PREVIEW, url: "/twitter-image.jpg" }] };

/** A page's own preview: its address, with the site's picture and name. */
export function pageMetadata(path: string): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  return { alternates: { canonical: path }, openGraph: { ...OG_BASE, url: path }, twitter: TWITTER_BASE };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Liam Hasson | Product Designer", template: "%s | Liam Hasson" },
  description: "Product designer who researches, prototypes and ships products people trust.",
  // (the preview image itself: app/opengraph-image.jpg and twitter-image.jpg, picked up by Next)
  openGraph: { siteName: "Liam Hasson", type: "website", locale: "en_US", url: "/" },
  twitter: { card: "summary_large_image" },
};

/** A case study's metadata: its title and line, its own address, and its peek as the shared picture. */
export function caseStudyMetadata(study: CaseStudy): Metadata {
  const peek = { url: study.peek.src, width: study.peek.width, height: study.peek.height, alt: study.peek.alt };
  return {
    title: `${study.title} case study`,
    description: study.line,
    alternates: { canonical: `/${study.slug}` },
    openGraph: { ...OG_BASE, url: `/${study.slug}`, images: [peek] },
    twitter: { card: "summary_large_image", images: [peek] },
  };
}
