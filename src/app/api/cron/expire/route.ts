import { NextRequest, NextResponse } from "next/server";
import { expireBookingsAndPickupOrders } from "@/lib/expiration/expire-service";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/expire] CRON_SECRET is not configured.");
    return false;
  }

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const querySecret = new URL(request.url).searchParams.get("secret") || "";

  return bearer === secret || querySecret === secret;
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await expireBookingsAndPickupOrders();
    return NextResponse.json({
      ok: true,
      expiredBookings: result.expiredBookings,
      expiredPickupOrders: result.expiredPickupOrders,
    });
  } catch (error) {
    console.error("[cron/expire] Expiration job failed:", error);
    return NextResponse.json({ ok: false, error: "Expiration job failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
