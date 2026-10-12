import { expect, test } from "vitest";
import { PAGES, SITE_URL, caseStudyMetadata, rootMetadata } from "./site";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as about } from "@/app/about/page";
import { metadata as contact } from "@/app/contact/page";
import { cyvore as cyvoreStudy } from "@/content/case-studies/cyvore";
const cyvore = caseStudyMetadata(cyvoreStudy);

test("the site's address, once: liamhasson.com (Liam, 2026-10-12)", () => {
  expect(SITE_URL).toBe("https://liamhasson.com");
  expect(rootMetadata.metadataBase?.toString()).toBe("https://liamhasson.com/");
});

test("link previews: a site name, a large card, the home page indexable", () => {
  expect(rootMetadata.openGraph).toMatchObject({ siteName: "Liam Hasson", type: "website" });
  expect(rootMetadata.twitter).toMatchObject({ card: "summary_large_image" });
  expect(rootMetadata.robots).toBeUndefined();
  expect(rootMetadata.alternates?.canonical).toBe("/");
});

test("robots allow everything and point at the sitemap; the sitemap lists every page", () => {
  const r = robots();
  expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
  expect(r.sitemap).toBe("https://liamhasson.com/sitemap.xml");
  expect(sitemap().map((e) => e.url)).toEqual(PAGES.map((p) => `https://liamhasson.com${p}`));
  expect(PAGES).toEqual(["/", "/eventread", "/cyvore", "/pulse", "/about", "/contact"]);
});

test("each page names its own canonical address; a case study shares its own picture", () => {
  expect(about.alternates?.canonical).toBe("/about");
  expect(contact.alternates?.canonical).toBe("/contact");
  expect(cyvore.alternates?.canonical).toBe("/cyvore");
  expect(JSON.stringify(cyvore.openGraph?.images)).toContain("/case-studies/cyvore/peek.jpg");
});
