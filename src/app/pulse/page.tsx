import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";

export const metadata: Metadata = { title: "Pulse case study" };

export default function PulsePage() {
  return (
    <article className="min-h-[200dvh] px-16 pb-32 pt-32">
      <BackButton slug="pulse" />
      <h1 className="text-6xl font-bold uppercase">Pulse</h1>
    </article>
  );
}
