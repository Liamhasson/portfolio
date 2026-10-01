import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";

export const metadata: Metadata = { title: "Eventread case study | Liam Hasson" };

export default function EventreadPage() {
  return (
    <article className="min-h-[200dvh] px-16 pb-32 pt-32">
      <BackButton slug="eventread" />
      <h1 className="text-6xl font-bold uppercase">Eventread</h1>
    </article>
  );
}
