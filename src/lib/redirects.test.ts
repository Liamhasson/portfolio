import { expect, test } from "vitest";
import { legacyRedirects } from "./redirects";

test("every live project's old Figma Sites URL redirects permanently", () => {
  expect(legacyRedirects).toEqual([
    { source: "/eventread-case-study", destination: "/eventread", permanent: true },
    { source: "/cyvore-case-study", destination: "/cyvore", permanent: true },
    { source: "/pulse-case-study", destination: "/pulse", permanent: true },
  ]);
});
