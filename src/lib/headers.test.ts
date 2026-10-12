import { expect, test } from "vitest";
import { siteHeaders } from "./headers";

const forPath = (path: string) => {
  const out: Record<string, string> = {};
  for (const rule of siteHeaders()) {
    const re = new RegExp("^" + rule.source.replace(/\/:path\*/g, "(/.*)?") + "$");
    if (re.test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
};

test("every page carries the browser's basic protections (Liam, 2026-10-13: security headers)", () => {
  const h = forPath("/eventread");
  expect(h["X-Content-Type-Options"]).toBe("nosniff");
  expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'self'");   // (no other site can frame it)
  expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
  expect(h["Permissions-Policy"]).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
});

test("the story's and the case studies' media is kept a day by browsers, then refreshed in the background: return visits load from cache, an update still arrives (names carry no hash, so never 'immutable')", () => {
  for (const p of ["/lab/desk3d/desk.glb", "/lab/sand/meta.json", "/work/cyvore.mp4", "/case-studies/pulse/peek.jpg", "/lab/basis/basis_transcoder.wasm"]) {
    const c = forPath(p)["Cache-Control"];
    expect(c, p).toBe("public, max-age=86400, stale-while-revalidate=604800");
  }
  expect(forPath("/about")["Cache-Control"]).toBeUndefined();   // (pages keep Next's own)
  expect(forPath("/Liam-Hasson-Resume.pdf")["Cache-Control"]).toBeUndefined();   // (the resume: always the latest)
});
