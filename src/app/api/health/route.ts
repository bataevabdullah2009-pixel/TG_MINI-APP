import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "vitrina-ai-mini-app",
    timestamp: new Date().toISOString(),
  });
}
