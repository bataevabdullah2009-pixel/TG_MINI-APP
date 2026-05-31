import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "smartbiz-ai-mini-app",
    timestamp: new Date().toISOString(),
  });
}
