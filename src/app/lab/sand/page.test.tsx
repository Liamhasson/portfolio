import { expect, test } from "vitest";
import SandLabPage from "./page";

// (Liam, 2026-10-12: Back and Projects from a case study left him "stuck … no text, no projects, nothing": the story read
// ?hero from window.location on its first render, which on a client-side navigation can still be the case study's URL,
// so it came up as the bare lab.) The page hands the story its mode from the request itself.
test("?hero comes from the request, not the browser's address bar", async () => {
  const story = await SandLabPage({ searchParams: Promise.resolve({ hero: "" }) });
  expect(story.props.hero).toBe(true);
  const lab = await SandLabPage({ searchParams: Promise.resolve({}) });
  expect(lab.props.hero).toBe(false);
});
