import { LOADER_BOOT } from "./lab/sand/loader-mode";
import { SandLabLoader } from "./lab/sand/sand-lab-loader";
import { StoryFallback } from "./story-fallback";
import { preloadStory } from "./story-preload";
import type { Metadata } from "next";

// (its own address here, not in the root's metadata: a 404 inherited it and named itself the home page)
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * The home page: the story (loader, hero, the shot to the desk and into the projects index). Moved here from
 * /lab/sand?hero for the launch (2026-10-12). The boot script runs before first paint: the nav and copy wait and
 * scrolling is locked while the loader plays (src/app/lab/sand/loader-mode.ts). Without JavaScript, a plain page.
 */
export default function Home() {
  preloadStory();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LOADER_BOOT }} />
      <SandLabLoader hero />
      {/* the home page in plain HTML: shown if the story never starts (the boot net), and without JavaScript */}
      <StoryFallback />
      <noscript>
        <style>{".story-fallback{display:block}"}</style>
      </noscript>
    </>
  );
}
