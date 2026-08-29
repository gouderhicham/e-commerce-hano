import type { Metadata } from "next";
import { ContactClient } from "./contact-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — pc store 39",
  description:
    "Une question sur un ordinateur reconditionné ? Notre équipe vous répond rapidement.",
};

export default function ContactPage() {
  return <ContactClient />;
}
