import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSessionUser } from "@/lib/auth/session";
import { getRepos } from "@/lib/data/repos";

export const metadata = {
  title: "Administration — pc store 39",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") redirect("/login?guard=admin");

  const badges = await getRepos().misc.adminBadges();

  return (
    <AdminShell user={user} initialBadges={badges}>
      {children}
    </AdminShell>
  );
}
