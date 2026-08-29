import { MessagesClient } from "./messages-client";
import type { ListEnvelope } from "@/lib/admin/use-server-list";
import type { ContactMessage } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages — Administration" };

export type MessagesEnvelope = ListEnvelope<ContactMessage> & {
  unreadCount: number;
};

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return <MessagesClient focusId={message ?? null} />;
}
