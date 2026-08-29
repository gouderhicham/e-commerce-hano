import { getRepos } from "@/lib/data/repos";
import { ParametresClient } from "./parametres-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paramètres — Administration" };

export default async function AdminParametresPage() {
  const settings = await getRepos().settings.get();
  return <ParametresClient initial={settings} />;
}
