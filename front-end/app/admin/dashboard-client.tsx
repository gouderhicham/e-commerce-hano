"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Home,
  Laptop,
  Layers,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";
import { fmtDA, frDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_PILLS } from "@/lib/labels";
import { Card, PageHeader, Pill, ProductThumb } from "@/components/admin/ui";
import { DELIVERY_NOTE, WARRANTY } from "@/lib/shop-config";
import type {
  CategoryWithCount,
  DashboardData,
  ProductPublic,
  TagGroup,
} from "@/lib/data/types";

/** One coherence warning between the back office and what the shop renders. */
interface Alert {
  label: string;
  detail: string;
  href: string;
}

export function DashboardClient({
  data,
  categories,
  tagGroups,
  products,
  categoryCardCount,
}: {
  data: DashboardData;
  categories: CategoryWithCount[];
  tagGroups: TagGroup[];
  products: ProductPublic[];
  /** Tiles the landing page actually renders (filterable categories only). */
  categoryCardCount: number;
}) {
  const filterableIds = new Set(
    categories.filter((c) => c.filterable).map((c) => c.id),
  );
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;

  // Products the customer can never reach through the sidebar, products with no
  // filterable attribute, and products still listed while out of stock.
  const hidden = products.filter((p) => !filterableIds.has(p.categoryId));
  const unfilterable = products.filter(
    (p) => Object.values(p.attributes).filter(Boolean).length === 0,
  );
  const outOfStock = products.filter((p) => p.stock <= 0 && p.active);

  const alerts: Alert[] = [
    hidden.length > 0 && {
      label: `${hidden.length} produit(s) dans une catégorie sans filtre catalogue`,
      detail: [...new Set(hidden.map((p) => categoryName(p.categoryId)))].join(", "),
      href: "/admin/categories",
    },
    unfilterable.length > 0 && {
      label: `${unfilterable.length} produit(s) sans attribut filtrable`,
      detail: unfilterable.map((p) => p.name).join(", "),
      href: "/admin/tags",
    },
    outOfStock.length > 0 && {
      label: `${outOfStock.length} produit(s) en rupture affiché(s) au catalogue`,
      detail: outOfStock.map((p) => p.name).join(", "),
      href: "/admin/stock",
    },
  ].filter(Boolean) as Alert[];

  const metrics = [
    {
      label: "Commandes Total",
      value: data.kpis.ordersTotal,
      hint: `${fmtDA(data.kpis.caTotal)} encaissés`,
      icon: ShoppingBag,
      tone: "bg-[#edf3ee] text-[#1d4538]",
      valueTone: "text-[#17251f]",
    },
    {
      label: "En Attente",
      value: data.kpis.newOrders,
      hint: "À confirmer par téléphone",
      icon: Clock,
      tone: "bg-amber-100 text-amber-800",
      valueTone: "text-amber-900",
    },
    {
      label: "Produits au Catalogue",
      value: data.kpis.activeProducts,
      hint: `${products.length - hidden.length} visibles via les filtres`,
      icon: Laptop,
      tone: "bg-[#edf3ee] text-[#1d4538]",
      valueTone: "text-[#17251f]",
    },
    {
      label: "Catégories (Cartes)",
      value: categoryCardCount,
      hint: `${tagGroups.length} groupes de filtres actifs`,
      icon: Layers,
      tone: "bg-[#edf3ee] text-[#1d4538]",
      valueTone: "text-[#17251f]",
    },
  ];

  const quickActions = [
    { href: "/admin/produits", label: "Gérer les produits", icon: Plus, primary: true },
    { href: "/admin/accueil", label: "Contenu page d'accueil", icon: Home },
    { href: "/admin/categories", label: "Gérer les catégories", icon: Layers },
    { href: "/admin/tags", label: "Tags & filtres catalogue", icon: Tag },
    { href: "/admin/vedette", label: "Modifier le Produit Vedette", icon: Sparkles },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Aperçu Général"
        title="Tableau de bord."
        hint="Chiffres calculés directement sur les données servies au frontoffice."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.15em] text-[#78827b]">
                  {metric.label}
                </span>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ${metric.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <b
                className={`mt-3 block font-mono text-3xl font-bold tracking-tight ${metric.valueTone}`}
              >
                {metric.value}
              </b>
              <p className="mt-1 text-[11px] text-[#627269]">{metric.hint}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
            <h2 className="text-lg font-medium tracking-tight text-[#17251f]">
              Commandes Récentes
            </h2>
            <Link
              href="/admin/commandes"
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10.5px] font-bold uppercase tracking-[.1em] text-[#1d4538] hover:underline"
            >
              <span>Voir tout</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {data.latestOrders.length === 0 ? (
            <p className="py-8 text-center text-xs font-medium text-[#78827b]">
              Aucune commande pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#17251f]/10 font-mono text-[9.5px] uppercase tracking-[.14em] text-[#78827b]">
                  <tr>
                    <th className="pb-3">Client</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Montant</th>
                    <th className="pb-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17251f]/5 font-medium">
                  {data.latestOrders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-[#f8faf7]">
                      <td className="py-3">
                        <p className="font-bold text-[#17251f]">
                          {order.customerName}
                        </p>
                        <span className="font-mono text-[10px] text-[#627269]">
                          {order.id}
                        </span>
                      </td>
                      <td className="py-3 text-[11px] text-[#4f5d55]">
                        {frDateTime(order.createdAt)}
                      </td>
                      <td className="py-3 font-mono font-bold text-[#1d4538]">
                        {fmtDA(order.total)}
                      </td>
                      <td className="py-3">
                        <Pill
                          label={ORDER_STATUS_LABELS[order.status]}
                          colors={ORDER_STATUS_PILLS[order.status]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 border-t border-[#17251f]/10 pt-4">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
              Cohérence avec le frontoffice
            </span>
            {alerts.length === 0 ? (
              <p className="mt-2 text-[11px] font-medium text-[#4f5d55]">
                Tous les produits sont rattachés à un filtre du catalogue.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {alerts.map((alert) => (
                  <Link
                    key={alert.label}
                    href={alert.href}
                    className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[10.5px] font-medium leading-4 text-amber-900 transition hover:bg-amber-100"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <b className="font-bold">{alert.label}</b>
                      <br />
                      {alert.detail}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <h2 className="mb-4 border-b border-[#17251f]/10 pb-3 text-lg font-medium tracking-tight text-[#17251f]">
              Actions Rapides
            </h2>
            <div className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl p-3.5 text-xs font-semibold transition ${
                      action.primary
                        ? "border border-[#1d4538]/20 bg-[#edf3ee] text-[#1d4538] hover:bg-[#1d4538] hover:text-white"
                        : "border border-[#17251f]/10 bg-white text-[#17251f] hover:border-[#1d4538] hover:text-[#1d4538]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" /> {action.label}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-1 border-t border-[#17251f]/10 pt-4 text-[11px] text-[#627269]">
            <p className="font-mono text-[9.5px] font-bold uppercase text-[#1d4538]">
              Réglages appliqués au site
            </p>
            <p>
              Livraison :{" "}
              <Link
                href="/admin/livraison"
                className="font-semibold text-[#1d4538] hover:underline"
              >
                tarif par wilaya &amp; commune
              </Link>
            </p>
            <p>Garantie : {WARRANTY}</p>
            <p>{DELIVERY_NOTE}</p>
          </div>
        </Card>
      </div>

      {data.stockAlerts.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
            <h2 className="text-lg font-medium tracking-tight text-[#17251f]">
              Alertes de stock
            </h2>
            <Link
              href="/admin/stock"
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10.5px] font-bold uppercase tracking-[.1em] text-[#1d4538] hover:underline"
            >
              <span>Gérer le stock</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.stockAlerts.map((product) => (
              <Link
                key={product.id}
                href={`/admin/produits?product=${product.id}`}
                className="flex items-center gap-3 rounded-xl border border-[#17251f]/10 bg-white p-3 transition hover:border-[#1d4538]/40"
              >
                <ProductThumb
                  imageUrl={product.imageUrl}
                  name={product.name}
                  tone={product.tone}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#17251f]">
                    {product.name}
                  </p>
                  <p className="font-mono text-[10px] text-[#627269]">
                    {product.stock} en stock
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
