import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    const categories = await prisma.category.findMany({
      where: {
        ...(businessId ? { businessId } : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("GET Categories Error:", error);
    return NextResponse.json({ error: "Ошибка загрузки категорий" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, businessId, sortOrder, isActive } = body;

    if (!name || !businessId) {
      return NextResponse.json({ error: "Название и ID бизнеса обязательны" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        businessId,
        isActive: isActive ?? true,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json({ ok: true, data: category, category }, { status: 201 });
  } catch (error: any) {
    console.error("POST Category Error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Такая категория уже есть." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Ошибка создания категории" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "ID категории обязателен" }, { status: 400 });
    }

    const body = await request.json();
    const { name, sortOrder, isActive } = body;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sortOrder !== undefined ? { sortOrder: parseInt(sortOrder) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("PATCH Category Error:", error);
    return NextResponse.json({ error: "Ошибка обновления категории" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID категории обязателен" }, { status: 400 });
    }

    // Delete items in category first or update them?
    // Let's delete the category, Prisma onDelete cascade or setNull will trigger.
    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Категория удалена" });
  } catch (error) {
    console.error("DELETE Category Error:", error);
    return NextResponse.json({ error: "Ошибка удаления категории. Убедитесь, что в ней нет привязанных товаров." }, { status: 500 });
  }
}
