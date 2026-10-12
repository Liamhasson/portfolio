/** The site's response headers (next.config.ts; Liam, 2026-10-13). */
type Rule = { source: string; headers: { key: string; value: string }[] };

/** The browser's basic protections, on every response: no type sniffing, a sane referrer, framed only by this site, no
 *  camera, microphone or location. (A full content policy would need nonces for the loader's inline boot script.) */
const SECURITY = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** The story's and the case studies' media: a day fresh, then refreshed in the background for a week. Their names carry
 *  no hash, so never "immutable": an update must still arrive. */
const MEDIA = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

export function siteHeaders(): Rule[] {
  return [
    { source: "/:path*", headers: SECURITY },
    ...["/lab/:path*", "/work/:path*", "/case-studies/:path*"].map((source) => ({ source, headers: MEDIA })),
  ];
}
