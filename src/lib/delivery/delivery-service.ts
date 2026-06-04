import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";

export async function releaseExpiredCourierAssignments(now = new Date()) {
  const assignments = await prisma.deliveryAssignment.findMany({
    where: {
      status: "ASSIGNED",
      pickupDeadline: { lt: now },
    },
    select: { id: true, orderId: true, courierId: true },
  });

  let released = 0;
  for (const assignment of assignments) {
    const changed = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.deliveryAssignment.updateMany({
        where: { id: assignment.id, status: "ASSIGNED", pickupDeadline: { lt: now } },
        data: { status: "EXPIRED", releasedAt: now },
      });
      if (updatedAssignment.count === 0) return false;

      await tx.order.updateMany({
        where: {
          id: assignment.orderId,
          status: "COURIER_ASSIGNED",
          deliveryStatus: "ASSIGNED",
        },
        data: {
          status: "READY_FOR_DELIVERY",
          deliveryStatus: "WAITING_COURIER",
          courierAssignedAt: null,
          courierPickupDeadline: null,
        },
      });
      return true;
    });

    if (!changed) continue;
    released += 1;
    NotificationService.notifyCourierAssignmentReleased(assignment.courierId, assignment.orderId).catch((error) =>
      console.warn(`[DELIVERY] Could not notify courier about released order ${assignment.orderId}:`, error)
    );
    NotificationService.notifyCouriersNewDelivery(assignment.orderId).catch((error) =>
      console.warn(`[DELIVERY] Could not notify couriers about returned order ${assignment.orderId}:`, error)
    );
  }

  return released;
}

export async function claimDelivery(orderId: string, courierId: string, pickupDeadline: Date) {
  return prisma.$transaction(async (tx) => {
    const courier = await tx.courier.findUnique({
      where: { id: courierId },
      select: { id: true, businessId: true, isActive: true },
    });
    if (!courier?.isActive) return null;

    const assignedAt = new Date();
    const claimed = await tx.order.updateMany({
      where: {
        id: orderId,
        businessId: courier.businessId,
        status: "READY_FOR_DELIVERY",
        deliveryStatus: "WAITING_COURIER",
      },
      data: {
        status: "COURIER_ASSIGNED",
        deliveryStatus: "ASSIGNED",
        courierAssignedAt: assignedAt,
        courierPickupDeadline: pickupDeadline,
      },
    });

    if (claimed.count !== 1) return null;

    const assignment = await tx.deliveryAssignment.upsert({
      where: { orderId },
      update: {
        courierId,
        status: "ASSIGNED",
        assignedAt,
        pickupDeadline,
        pickedUpAt: null,
        deliveredAt: null,
        releasedAt: null,
      },
      create: {
        orderId,
        courierId,
        status: "ASSIGNED",
        assignedAt,
        pickupDeadline,
      },
    });

    return assignment;
  });
}
