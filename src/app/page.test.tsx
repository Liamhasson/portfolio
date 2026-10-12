import { expect, test } from "vitest";
import Home from "./page";
import { LOADER_BOOT } from "./lab/sand/loader-mode";

const kids = (el: React.ReactElement) => [(el.props as { children: React.ReactNode }).children].flat(3).filter(Boolean) as React.ReactElement[];

test("the home page is the story (pre-launch audit, 2026-10-12): the loader's boot script before first paint, then the story itself", () => {
  const parts = kids(Home());
  expect(parts[0].type).toBe("script");
  expect((parts[0].props as { dangerouslySetInnerHTML: { __html: string } }).dangerouslySetInnerHTML.__html).toBe(LOADER_BOOT);
  const story = parts.find((p) => (p.props as { hero?: boolean }).hero !== undefined)!;
  expect((story.props as { hero: boolean }).hero).toBe(true);
});
