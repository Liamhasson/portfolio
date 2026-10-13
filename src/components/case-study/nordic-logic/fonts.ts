import { IBM_Plex_Mono, Instrument_Sans, Schibsted_Grotesk } from "next/font/google";

// Nordic Logic's own type (web-v2 DESIGN.md §3): only inside the product, the first audit and the system strip.
export const schibsted = Schibsted_Grotesk({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
export const instrument = Instrument_Sans({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-instrument", display: "swap" });
export const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono", display: "swap" });
/** The classes that define the three variables, plus .nl-fonts, which turns them into the --nl-* stacks. */
export const nordicFonts = ["nl-fonts", schibsted.variable, instrument.variable, plexMono.variable].join(" ");
