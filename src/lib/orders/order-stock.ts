import type { Prisma } from "@prisma/client";

export async function restoreTrackedStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  const claimed = await tx.order.updateMany({
    where: {
      id: orderId,
      stockRestoredAt: null,
    },
    data: {
      stockRestoredAt: new Date(),
    },
  });

  if (claimed.count !== 1) return false;

  const orderItems = await tx.orderItem.findMany({
    where: {
      orderId,
      itemId: { not: null },
    },
    select: {
      itemId: true,
      quantity: true,
    },
  });

  for (const orderItem of orderItems) {
    if (!orderItem.itemId || orderItem.quantity <= 0) continue;

    await tx.item.updateMany({
      where: {
        id: orderItem.itemId,
        stockMode: "TRACK_STOCK",
        stock: { not: null },
      },
      data: {
        stock: { increment: orderItem.quantity },
      },
    });

    await tx.item.updateMany({
      where: {
        id: orderItem.itemId,
        stockMode: "TRACK_STOCK",
        stock: { gt: 0 },
        archivedAt: null,
      },
      data: {
        isAvailable: true,
      },
    });
  }

  return true;
}
