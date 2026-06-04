import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logDatabaseDiagnostics, runDatabaseDiagnostics } from "@/lib/db-diagnostics";
import { classifyDatabaseError } from "@/lib/prisma-schema-guard";

export const dynamic = "force-dynamic";

function canRunDetailedDiagnostics(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = new URL(request.url).searchParams.get("secret");
  return bearer === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  try {
    const diagnose = new URL(request.url).searchParams.get("diagnose") === "1";
    if (diagnose) {
      if (!canRunDetailedDiagnostics(request)) {
        return NextResponse.json(
          { ok: false, error: "Database diagnostics require CRON_SECRET authorization." },
          { status: 401 }
        );
      }

      const diagnostics = await runDatabaseDiagnostics();
      logDatabaseDiagnostics(diagnostics);
      return NextResponse.json(diagnostics, { status: diagnostics.ok ? 200 : 503 });
    }

    const businessCount = await prisma.business.count();
    return NextResponse.json({
      ok: true,
      db: "connected",
      stats: { businesses: businessCount },
    });
  } catch (error) {
    const classification = classifyDatabaseError(error);
    console.error("[DB DIAGNOSTIC] Database health check failed:", {
      diagnosticCode: classification.code,
      type: classification.type,
      patch: classification.patch,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        db: "disconnected",
        code: classification.code,
        error: "Database is unavailable or its schema is behind prisma/schema.prisma.",
        details: process.env.NODE_ENV === "development" ? classification.message : undefined,
      },
      { status: 500 }
    );
  }
}
