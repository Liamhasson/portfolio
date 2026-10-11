import { Manrope, Space_Grotesk } from "next/font/google";

// The Pulse app's own type (Pulse v2 · Design System): only inside the coded screens.
export const spaceGrotesk = Space_Grotesk({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
export const manrope = Manrope({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-manrope", display: "swap" });
export const pulseAppFontVariables = [spaceGrotesk.variable, manrope.variable].join(" ");
