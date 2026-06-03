import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true },
    });

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
