import type { Metadata } from "next";
import { SandLabLoader } from "./sand-lab-loader";

export const metadata: Metadata = {
  title: "Sand lab",
  robots: { index: false, follow: false },
};

/** Build step 2: the live sand prototype (docs/superpowers/plans/2026-10-09-live-sand-prototype.md). Not linked. */
export default function SandLabPage() {
  return <SandLabLoader />;
}
