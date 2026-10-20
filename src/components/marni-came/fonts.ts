import { Archivo, Cormorant_Garamond } from "next/font/google";

// Marni Came's own type (spec 2026-10-20 §2 Decision 7): only inside the brand material and the band site.
export const cormorant = Cormorant_Garamond({ weight: ["600"], subsets: ["latin"], variable: "--font-cormorant", display: "swap" });
export const archivo = Archivo({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-archivo", display: "swap" });
/** The classes that define the two variables, plus .mc-fonts, which turns them into the --mc-* stacks. */
export const marniFonts = ["mc-fonts", cormorant.variable, archivo.variable].join(" ");
