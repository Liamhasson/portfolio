import { expect, test } from "vitest";
import { labRedirect, legacyRedirects } from "./redirects";

test("on the live site the old story address goes home; the lab stays for local tools (pre-launch audit, 2026-10-12)", () => {
  expect(labRedirect("production")).toEqual([{ source: "/lab/sand", destination: "/", permanent: false }]);
  expect(labRedirect("development")).toEqual([]);
  expect(legacyRedirects.every((r) => r.source.endsWith("-case-study"))).toBe(true);
});
