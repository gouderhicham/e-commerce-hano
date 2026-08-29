import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSessionUser } from "@/lib/auth/session";

import type { AdminBadges } from "@/lib/data/types";

export const metadata = {
  title: "Administration — pc store 39",
};

export const dynamic = "force-dynamic";

const DEFAULT_BADGES: AdminBadges = {
  newOrders: 0,
  unreadQuotes: 0,
  unreadMessages: 0,
  unreadNotifications: 0,
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") redirect("/login?guard=admin");

  return (
    <AdminShell user={user} initialBadges={DEFAULT_BADGES}>
      {children}
    </AdminShell>
  );
}
