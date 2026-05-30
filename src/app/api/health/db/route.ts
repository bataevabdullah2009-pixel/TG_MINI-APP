import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Perform a simple count request to verify connection integrity
    const businessCount = await prisma.business.count();
    
    return NextResponse.json({
      ok: true,
      db: "connected",
      stats: {
        businesses: businessCount
      }
    });
  } catch (error: any) {
    console.error("❌ Database Health Check Failed:", error);
    
    // Output a clean error message without exposing password secrets
    return NextResponse.json(
      {
        ok: false,
        db: "disconnected",
        error: "Не удалось подключиться к базе данных. Проверьте правильность DATABASE_URL и DIRECT_URL в панели Vercel.",
        details: process.env.NODE_ENV === "development" ? error.message || error : undefined
      },
      { status: 500 }
    );
  }
}
