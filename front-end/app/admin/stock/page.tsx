import { fetchAdminList } from "@/lib/admin/server-list";
import { StockClient, type StockEnvelope } from "./stock-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stock — Administration" };

export default async function AdminStockPage() {
  const initial = await fetchAdminList<StockEnvelope>(
    "/api/admin/products?page=1",
  );
  return <StockClient initial={initial} />;
}
