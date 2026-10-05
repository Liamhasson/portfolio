import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";

export const metadata: Metadata = { title: "Cyvore case study" };

export default function CyvorePage() {
  return (
    <article className="min-h-[200dvh] px-16 pb-32 pt-32">
      <BackButton slug="cyvore" />
      <h1 className="text-6xl font-bold uppercase">Cyvore</h1>
    </article>
  );
}
