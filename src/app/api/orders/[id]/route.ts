import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";
import { classifyDatabaseError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

const legacyOrderDetailSelect = {
  id: true,
  businessId: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  customerAddress: true,
  totalPrice: true,
  status: true,
  deliveryType: true,
  paymentMethod: true,
  paymentStatus: true,
  paymentProofUrl: true,
  paymentProofAiStatus: true,
  paymentProofAiSummary: true,
  paymentProofAiConfidence: true,
  paymentReviewedAt: true,
  paymentReviewedBy: true,
  paymentRejectReason: true,
  comment: true,
  internalNotes: true,
  expiredAt: true,
  expireReason: true,
  createdAt: true,
  updatedAt: true,
  items: true,
  payment: true,
} as const;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let order;
    try {
      order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
          payment: true,
          deliveryZone: true,
          deliveryAssignment: { include: { courier: true } },
        },
      });
    } catch (error) {
      const classification = classifyDatabaseError(error);
      if (classification.type !== "missing_table" && classification.type !== "missing_column") throw error;
      warnPrismaSchemaDrift(`Order ${id} retried without courier/delivery relations`, error);
      order = await prisma.order.findUnique({
        where: { id },
        select: legacyOrderDetailSelect,
      });
    }

    if (!order) {
      return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Не удалось загрузить заказ." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, internalNotes } = body;

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        internalNotes,
      },
      include: { items: true },
    });

    await NotificationService.notifyCustomerOrderStatus(order.customerId, order.id);

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Не удалось обновить заказ." }, { status: 500 });
  }
}
