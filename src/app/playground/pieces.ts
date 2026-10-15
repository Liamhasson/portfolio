/**
 * The playground's pieces (Liam, 2026-10-14/15): the work outside product design, behind the drive on the desk. Every
 * fact here is Liam's own (titles, years, roles); files in public/playground. The grid is hand-arranged (layout A): rows of
 * pieces, each with its share of the row's width, the strongest largest.
 */
export type Kind = "Music" | "Art" | "3D" | "Motion" | "Photo" | "Film";

export interface Piece {
  id: string;
  kind: Kind;
  title: string;
  /** the tile's short line, right of the title */
  meta: string;
  /** opened: what Liam did, in his words */
  credit: string;
  /** the still: poster for films, the image itself for art and photos (in /playground) */
  image?: string;
  /** a silent loop that plays on hover */
  loop?: string;
  /** opened: a film streamed from YouTube, or hosted here */
  youtube?: string;
  video?: string;
  /** a track: its audio, its waveform (peaks.json) and where else to hear it */
  audio?: string;
  peaks?: string;
  listen?: { label: string; href: string };
  /** a light image: the tile's words in ink, not light */
  light?: boolean;
  /** the image is a mark on a transparent ground: shown whole, on the dark */
  contain?: boolean;
  /** its share of its row's width (layout A) */
  w: number;
}

const P = (f: string) => `/playground/${f}`;

export const ROWS: Piece[][] = [
  [
    {
      id: "after-heartbreaks-film", kind: "Film", title: "Marni Came · After Heartbreaks", meta: "Director · Editor",
      credit: "Directed, produced and edited it, played in it, and co-graded the colour.",
      image: P("after-heartbreaks-film.jpg"), loop: P("after-heartbreaks-loop.mp4"), youtube: "RnCQCxEN-vM",
      listen: { label: "Listen on Spotify", href: "https://open.spotify.com/track/4tAE4udEUdI2zK1M3vaQbC" }, w: 586,
    },
    {
      // (the split-face cover art on this track's tile; Liam, 2026-10-15)
      id: "youll-be-you", kind: "Music", title: "Marni Came · You'll Be You", meta: "3:16", credit: "Sang, played guitar, produced and wrote it.",
      image: P("after-heartbreaks-cover.jpg"), audio: P("youll-be-you.m4a"), peaks: P("youll-be-you.peaks.json"), w: 330,
    },
    {
      id: "is-it-all", kind: "Film", title: "Sanskrit · Is It All", meta: "Director · Editor", credit: "Wrote it, directed, edited, produced and mixed it.",
      image: P("is-it-all.jpg"), loop: P("is-it-all-loop.mp4"), youtube: "QhhX9M16yhw", w: 380,
    },
  ],
  [
    {
      id: "dopamine", kind: "Film", title: "Marni Came · Dopamine (live)", meta: "Co-director · Editor",
      credit: "Wrote, composed and performed it, co-directed, edited and produced the video.",
      image: P("dopamine.jpg"), loop: P("dopamine-loop.mp4"), video: P("dopamine.mp4"), w: 520,
    },
    {
      id: "untitled-cover", kind: "Art", title: "Untitled · cover", meta: "Unreleased · 2024", credit: "A fun project, never released. 2024.",
      image: P("untitled-cover-2024.jpg"), light: true, w: 292,
    },
    {
      id: "live-lido", kind: "Photo", title: "Live at Lido, Berlin", meta: "Dec 2024",
      credit: "Marni Came live at Lido, Berlin, December 2024. Me on guitar.", image: P("live-lido-berlin.jpg"), w: 484,
    },
  ],
  [
    {
      id: "my-small-world", kind: "Film", title: "Sanskrit · My Small World", meta: "Director · Editor",
      credit: "Wrote it, directed, edited, produced and mixed it. Sanskrit was my band before Marni Came.",
      image: P("my-small-world.jpg"), loop: P("my-small-world-loop.mp4"), youtube: "xj7WOprfJuA",
      listen: { label: "Sanskrit III on Spotify", href: "https://open.spotify.com/album/5Yu23QtYo9YAC6W98CIFxm" }, w: 462,
    },
    { id: "untitled-3d", kind: "3D", title: "Untitled", meta: "Abstract 3D", credit: "An abstract 3D piece.", image: P("untitled-3d.jpg"), w: 420 },
    {
      id: "hello", kind: "Motion", title: "Hello", meta: "Figma motion", credit: "Playing with Figma's motion tools.",
      image: P("hello.jpg"), loop: P("hello-loop.mp4"), video: P("hello-loop.mp4"), w: 414,
    },
  ],
  [{ id: "marni-came-logotype", kind: "Art", title: "Marni Came · logotype", meta: "Identity", credit: "The band's logotype.", image: P("marni-came-logotype.png"), contain: true, w: 1328 }],
];

/** The rows' heights on a wide screen, as a share of the window's width (the mockup's 1440 frame). */
export const ROW_HEIGHT_VW = [22.9, 20.3, 18, 15.3];

export const PIECES: Piece[] = ROWS.flat();
