import { fetchAdminList } from "@/lib/admin/server-list";
import type { ListEnvelope } from "@/lib/admin/use-server-list";
import type { ContactMessage } from "@/lib/data/types";
import { MessagesClient } from "./messages-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages — Administration" };

export type MessagesEnvelope = ListEnvelope<ContactMessage> & {
  unreadCount: number;
};

export default async function AdminMessagesPage({
  searchParams,
}: {
  // `?message=<id>` — where a "nouveau message" notification lands. The
  // backend answers with the page that holds it, whatever its position.
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const initial = await fetchAdminList<MessagesEnvelope>(
    `/api/admin/messages?page=1${
      message ? `&focus=${encodeURIComponent(message)}` : ""
    }`,
  );
  return <MessagesClient initial={initial} focusId={message ?? null} />;
}
