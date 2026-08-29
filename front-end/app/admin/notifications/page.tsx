import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications — Administration" };

export default function AdminNotificationsPage() {
  return <NotificationsClient />;
}
