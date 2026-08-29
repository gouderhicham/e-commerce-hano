import { getRepos } from "@/lib/data/repos";
import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications — Administration" };

export default async function AdminNotificationsPage() {
  const initial = await getRepos().notifications.latest();
  return <NotificationsClient initial={initial} />;
}
