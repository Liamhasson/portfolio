// src/app/playground/page.tsx
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Playground } from "./playground";

export const metadata: Metadata = { title: "Playground", description: "Liam Hasson off the clock: music, art, 3D, motion, photographs and films.", ...pageMetadata("/playground") };

export default function PlaygroundPage() {
  return <Playground />;
}
