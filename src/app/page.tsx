import { LOADER_BOOT } from "./lab/sand/loader-mode";
import { SandLabLoader } from "./lab/sand/sand-lab-loader";

/**
 * The home page: the story (loader, hero, the shot to the desk and into the projects index). Moved here from
 * /lab/sand?hero for the launch (2026-10-12). The boot script runs before first paint: the nav and copy wait and
 * scrolling is locked while the loader plays (src/app/lab/sand/loader-mode.ts). Without JavaScript, a plain page.
 */
export default function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LOADER_BOOT }} />
      <SandLabLoader hero />
      <noscript>
        <div style={{ padding: "18vh 6vw", maxWidth: 760, color: "#f4efe9" }}>
          <h1 style={{ fontSize: 48, fontWeight: 400, margin: 0 }}>Hi, I&rsquo;m Liam.</h1>
          <p style={{ fontSize: 20, opacity: 0.8 }}>I build ambiguous ideas into products where design and user needs meet.</p>
          <ul style={{ fontSize: 20, lineHeight: 1.8, paddingLeft: 18 }}>
            <li><a href="/eventread">Eventread</a></li>
            <li><a href="/cyvore">Cyvore</a></li>
            <li><a href="/pulse">Pulse</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
      </noscript>
    </>
  );
}
