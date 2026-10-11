import type { Metadata } from "next";
import { SandLabLoader } from "./sand-lab-loader";

export const metadata: Metadata = {
  title: "Sand lab",
  robots: { index: false, follow: false },
};

/** Build step 2: the live sand prototype (docs/superpowers/plans/2026-10-09-live-sand-prototype.md); with ?hero, the story.
 *  The mode comes from the request (Liam, 2026-10-12): read from window.location on the first render, a client-side
 *  navigation from a case study could still see the case study's URL and bring up the bare lab. */
export default async function SandLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <SandLabLoader hero={"hero" in (await searchParams)} />;
}
