import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

// Type locked 2026-10-09: Geist for everything, Geist Mono for labels and footnotes (free, SIL OFL; self-hosted by
// next/font). Sans only, no serif anywhere. Weights: 400 display and text, 500 buttons and labels, nothing heavier
// (the hero's outlined LIAM HASSON was removed on 2026-10-12: Liam, "it's not adding anything").
export const fontVariables = [GeistSans.variable, GeistMono.variable].join(" ");
