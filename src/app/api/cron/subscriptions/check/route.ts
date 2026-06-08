import { NextRequest, NextResponse } from "next/server";
import { checkBusinessSubscriptions } from "@/lib/subscriptions/business-subscription-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret &&
      request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await checkBusinessSubscriptions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/subscriptions/check] Job failed:", error);
    return NextResponse.json(
      { ok: false, error: "Subscription check failed." },
      { status: 500 }
    );
  }
}

