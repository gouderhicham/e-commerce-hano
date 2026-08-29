import { OrderStatus } from "@prisma/client";

/** Statuses that imply the order has been completed/delivered. */
export const COMPLETED_OR_DELIVERED: OrderStatus[] = [OrderStatus.LIVREE];
export const PAID_OR_LATER: OrderStatus[] = [OrderStatus.LIVREE];
