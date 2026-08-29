import { getRepos } from "@/lib/data/repos";
import { VedetteClient } from "./vedette-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produit vedette — Administration" };

export default async function AdminVedettePage() {
  const content = await getRepos().content.siteContent();
  return <VedetteClient initial={content.showcase} />;
}
