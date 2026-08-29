import { ParametresClient } from "./parametres-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paramètres — Administration" };

export default function AdminParametresPage() {
  return <ParametresClient />;
}
