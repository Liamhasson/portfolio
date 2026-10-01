import { DM_Mono, Host_Grotesk, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";

export const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-host-grotesk",
  display: "swap",
});

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const fontVariables = [hostGrotesk, plusJakarta, playfair, dmMono]
  .map((f) => f.variable)
  .join(" ");
