import { expect, test } from "vitest";
import SandLabPage from "./page";

// (Liam, 2026-10-12: Back and Projects from a case study left him "stuck … no text, no projects, nothing": the story read
// ?hero from window.location on its first render, which on a client-side navigation can still be the case study's URL,
// so it came up as the bare lab.) The page hands the story its mode from the request itself.
const parts = (el: React.ReactElement) => (el.props as { children: React.ReactNode[] }).children.filter(Boolean) as React.ReactElement[];

test("?hero comes from the request, not the browser's address bar", async () => {
  const story = parts(await SandLabPage({ searchParams: Promise.resolve({ hero: "" }) }));
  expect((story.at(-1)!.props as { hero: boolean }).hero).toBe(true);
  const lab = parts(await SandLabPage({ searchParams: Promise.resolve({}) }));
  expect((lab.at(-1)!.props as { hero: boolean }).hero).toBe(false);
});

test("the loader's boot script runs before first paint on the story only", async () => {
  const story = parts(await SandLabPage({ searchParams: Promise.resolve({ hero: "" }) }));
  expect(story[0].type).toBe("script");
  const lab = parts(await SandLabPage({ searchParams: Promise.resolve({}) }));
  expect(lab.some((e) => e.type === "script")).toBe(false);
});
