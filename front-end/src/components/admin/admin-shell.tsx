"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ExternalLink,
  Home,

  Laptop,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Settings,
  Sparkles,
  Tag,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { AdminBadgesContext } from "@/components/admin/badges-context";
import type { AdminBadges, PublicUser } from "@/lib/data/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  /** Which counter of GET /api/admin/badges lights this entry up. */
  badge?: keyof AdminBadges;
}

/**
 * Sidebar. The first group mirrors the reference design's back office; the
 * second keeps the sections that design didn't draw but the shop still needs
 * (devis, paiements, clients, messages, stock).
 */
/** How often the back office re-reads its badge counters while visible. */
const BADGE_POLL_MS = 30_000;

const NAV_SITE: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/accueil", label: "Page d'accueil", icon: Home },
  { href: "/admin/vedette", label: "Produit Vedette", icon: Sparkles },
  { href: "/admin/produits", label: "Produits & Fiches", icon: Laptop },
  { href: "/admin/categories", label: "Catégories (Cartes)", icon: Layers },
  { href: "/admin/commandes", label: "Commandes", icon: Package, badge: "newOrders" },
  { href: "/admin/tags", label: "Tags & Filtres", icon: Tag },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

const NAV_OPS: NavItem[] = [
  { href: "/admin/stock", label: "Stock", icon: Warehouse },
  { href: "/admin/livraison", label: "Livraison & Tarifs", icon: Truck },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, badge: "unreadMessages" },
  { href: "/admin/clients", label: "Clients", icon: Users },
];

function NavLink({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-left transition ${
        active
          ? "bg-[#1d4538] font-bold text-white shadow-sm"
          : "text-[#4e5d56] hover:bg-[#edf3ee] hover:text-[#1d4538]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 && (
        <span
          className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold ${
            active ? "bg-white/25 text-white" : "bg-[#1d4538] text-white"
          }`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function AdminShell({
  user,
  initialBadges,
  children,
}: {
  user: PublicUser;
  initialBadges: AdminBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState(initialBadges);
  const [signingOut, setSigningOut] = useState(false);

  /** Shared with the pages that mutate counters without navigating. */
  const refreshBadges = useCallback(async () => {
    const data = await apiFetch("/api/admin/badges")
      .then((res) => (res.ok ? (res.json() as Promise<AdminBadges>) : null))
      // A stale counter is not worth surfacing an error for.
      .catch(() => null);
    if (data) setBadges(data);
  }, []);

  // Counters go stale as soon as an order is handled or a message is read, so
  // re-read them on every navigation. Pages that mutate without navigating
  // (notifications, messages) call refresh() through AdminBadgesContext.
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/admin/badges")
      .then((res) => (res.ok ? (res.json() as Promise<AdminBadges>) : null))
      .then((data) => {
        if (data && !cancelled) setBadges(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Badge counters used to arrive over SSE. A Worker isolate is per-request and
  // short-lived, so nothing can hold that stream open — and billing an idle
  // socket is the opposite of what this app is optimised for. Polling replaces
  // it, but only while the tab is actually visible: a back-office left open in
  // a background tab costs nothing.
  useEffect(() => {
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(() => void refreshBadges(), BADGE_POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshBadges(); // catch up on whatever happened while hidden
        start();
      } else stop();
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [refreshBadges]);

  const isActive = useCallback(
    (item: NavItem) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    [pathname],
  );

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  const renderNav = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink
        key={item.href}
        item={item}
        active={isActive(item)}
        count={item.badge ? badges[item.badge] : 0}
        onNavigate={() => setSidebarOpen(false)}
      />
    ));

  return (
    <AdminBadgesContext.Provider
      value={{ badges, refresh: refreshBadges }}
    >
    <div className="flex min-h-screen bg-[#f8f7f2] font-sans text-[#17251f]">
      {/* Sidebar: Full height, sticky top-0, thin light-scrollbar */}
      <aside
        className={`light-scrollbar fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-[#17251f]/10 bg-[#f8f7f2] p-5 transition-transform duration-300 md:sticky md:top-0 md:z-30 md:h-screen md:shrink-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Logo Header in Sidebar */}
        <div className="mb-6 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
          <Link href="/" className="group flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/pc-logo.jpg"
              alt="Logo pc store .39"
              className="h-9 w-9 rounded-full border border-[#1d4538]/20 object-cover shadow-sm transition duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col justify-center leading-none">
              <div className="flex items-baseline gap-1 font-mono text-[15px] font-extrabold uppercase tracking-[.16em] text-[#17251f]">
                <span>pc store</span>
                <span className="font-black text-[#1d4538]">.39</span>
              </div>
              <span className="mt-1 font-mono text-[7.5px] font-bold uppercase tracking-[.18em] text-[#78827b]">
                Backoffice Admin
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer"
            className="cursor-pointer text-[#17251f] md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 px-2 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-[#78827b]">
          Gestion du site
        </p>
        <nav className="space-y-1 text-xs font-semibold">
          {renderNav(NAV_SITE)}
        </nav>

        <p className="mb-4 mt-8 px-2 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-[#78827b]">
          Exploitation
        </p>
        <nav className="space-y-1 text-xs font-semibold">
          {renderNav(NAV_OPS)}
        </nav>
      </aside>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Right Column: Top Bar + Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-40 border-b border-[#17251f]/10 bg-[#f8f7f2]/95 backdrop-blur-md">
          <div className="flex h-[78px] items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Menu administration"
                aria-expanded={sidebarOpen}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#17251f] md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 font-mono text-[14px] font-bold uppercase tracking-[.15em] text-[#17251f] md:hidden">
                <span>pc store</span>
                <span className="font-black text-[#1d4538]">.39</span>
                <span className="rounded-full bg-[#1d4538] px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[.1em] text-white">
                  Admin
                </span>
              </div>
              <div className="hidden items-center gap-2 text-xs font-semibold text-[#58675f] md:flex">
                <span className="font-mono text-[9.5px] uppercase tracking-[.2em] text-[#78827b]">
                  Panneau d&apos;administration
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/admin/notifications"
                aria-label={`Notifications (${badges.unreadNotifications})`}
                className="relative hidden h-9 w-9 place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#17251f] transition hover:bg-[#edf3ee] sm:grid"
              >
                <Bell className="h-4 w-4" />
                {badges.unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#1d4538] px-1 font-mono text-[9px] font-bold leading-none text-white">
                    {badges.unreadNotifications > 99
                      ? "99+"
                      : badges.unreadNotifications}
                  </span>
                )}
              </Link>
              <Link
                href="/"
                target="_blank"
                className="hidden items-center gap-2 rounded-full border border-[#1d4538]/20 bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-[#1d4538] shadow-2xs transition hover:bg-[#edf3ee] sm:inline-flex"
              >
                <span>Voir le site</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <div className="flex items-center gap-2 rounded-full border border-[#17251f]/10 bg-white px-3 py-1.5 shadow-2xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#1d4538]" />
                <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[.1em] text-[#17251f] lg:block">
                  {user.name.split(" ")[0]}
                </span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-[#17251f] lg:hidden">
                  En Ligne
                </span>
              </div>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#17251f] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#f8f7f2] p-5 sm:p-10">
          {children}
        </main>
      </div>
    </div>
    </AdminBadgesContext.Provider>
  );
}
