import type { Metadata } from "next";
import { FavorisClient } from "./favoris-client";

export const metadata: Metadata = {
  title: "Mes favoris — pc store 39",
};

export default function FavorisPage() {
  return <FavorisClient />;
}
