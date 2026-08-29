import { StockClient } from "./stock-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stock — Administration" };

export default function AdminStockPage() {
  return <StockClient />;
}
