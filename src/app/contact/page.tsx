// src/app/contact/page.tsx
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { ContactScene } from "./contact-scene";

export const metadata: Metadata = { title: "Contact", description: "Got something on your mind? Email, LinkedIn or call Liam Hasson.", ...pageMetadata("/contact") };

export default function ContactPage() {
  return <ContactScene />;
}
