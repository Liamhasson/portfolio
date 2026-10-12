import { preload } from "react-dom";

/**
 * The story's first files, started by the HTML itself (Liam, 2026-10-13): three.js and the sand used to wait for the
 * main script to run. Only what every tier loads (the density volumes, the first grains, the hero's haze and grain, the
 * shot), each in the mode its loader asks for (fetch() and three's images are CORS), so the browser reuses it.
 */
export const STORY_PRELOAD: { href: string; as: "fetch" | "image"; crossOrigin: "anonymous" }[] = [
  "/lab/sand/sand.json", "/lab/sand/vol_chaos.bin", "/lab/sand/vol_mid.bin", "/lab/sand/vol_ball.bin", "/lab/sand/sand_0.bin",
  "/lab/sand/haze-hero.json", "/lab/shot/camera.json", "/lab/grain.png", "/lab/sand/haze-hero.png",
].map((href) => ({ href, as: href.endsWith(".png") ? "image" : "fetch", crossOrigin: "anonymous" }));

export function preloadStory(): void {
  for (const { href, as, crossOrigin } of STORY_PRELOAD) preload(href, { as, crossOrigin });
}
