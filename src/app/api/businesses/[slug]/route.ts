import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        settings: true,
        categories: { where: { isActive: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...business,
      telegramAdminChatId: business.telegramAdminChatId?.toString() || null,
    });
  } catch (error) {
    console.error("Error fetching business:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
