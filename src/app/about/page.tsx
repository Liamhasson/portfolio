// src/app/about/page.tsx
import type { Metadata } from "next";
import { AboutTrack } from "./about-track";

export const metadata: Metadata = { title: "About", description: "Liam Hasson, product designer: how I work, what people say, what I do." };

export default function AboutPage() {
  return <AboutTrack />;
}
