// src/app/about/page.tsx
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { AboutTrack } from "./about-track";

export const metadata: Metadata = { title: "About", description: "Liam Hasson, product designer: how I work, what people say, what I do.", ...pageMetadata("/about") };

export default function AboutPage() {
  return <AboutTrack />;
}
