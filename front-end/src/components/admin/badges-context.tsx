"use client";

import { createContext, useContext } from "react";
import type { AdminBadges } from "@/lib/data/types";

interface BadgesContextValue {
  badges: AdminBadges;
  /** Re-read GET /api/admin/badges — call it right after a mutation. */
  refresh: () => Promise<void>;
}

const EMPTY: AdminBadges = {
  newOrders: 0,
  unreadQuotes: 0,
  unreadMessages: 0,
  unreadNotifications: 0,
};

export const AdminBadgesContext = createContext<BadgesContextValue>({
  badges: EMPTY,
  refresh: async () => {},
});

/**
 * Sidebar + bell counters. AdminShell refreshes them on every navigation, but
 * marking a notification or a message as read happens without navigating, so
 * those pages call `refresh()` themselves — otherwise the bell keeps showing
 * the stale unread count.
 */
export function useAdminBadges(): BadgesContextValue {
  return useContext(AdminBadgesContext);
}
