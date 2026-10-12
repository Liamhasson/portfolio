/** Where the story lives (spec 2026-10-11-scene-order-design.md §6): the home page (moved from /lab/sand?hero for the
 *  launch, 2026-10-12). */
export const STORY_PATH = "/";
export const STORY_HREF = "/";

/** The story's old section anchors now have their own pages (spec 2026-10-12-about-contact-design.md §5). */
export function sectionRedirect(hash: string): "/about" | "/contact" | null {
  return hash === "#about" ? "/about" : hash === "#contact" ? "/contact" : null;
}
