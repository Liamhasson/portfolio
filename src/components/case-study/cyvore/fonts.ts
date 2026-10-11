import { Iceland, Inter, Michroma } from "next/font/google";

// The replica's own type (refined version C): only inside Cyvore's product visuals.
export const michroma = Michroma({ weight: "400", subsets: ["latin"], variable: "--font-michroma", display: "swap" });
export const iceland = Iceland({ weight: "400", subsets: ["latin"], variable: "--font-iceland", display: "swap" });
export const inter = Inter({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const cyvoreFontVariables = [michroma.variable, iceland.variable, inter.variable].join(" ");
