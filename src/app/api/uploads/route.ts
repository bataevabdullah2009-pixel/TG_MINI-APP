import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bucketForUploadType, publicUploadErrorMessage, uploadImageToSupabaseStorage } from "@/lib/supabase-storage";
import { isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";
import { canBusinessOperate } from "@/lib/subscriptions/business-subscription-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const form = await request.formData();
    const file = form.get("file");
    const type = String(form.get("type") || "gallery");
    const businessValue = String(form.get("businessId") || form.get("businessSlug") || session.businessId || "");

    if (!(file instanceof File)) return NextResponse.json({ error: "Файл не передан." }, { status: 400 });

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessValue }, { slug: businessValue }] },
      select: { id: true, slug: true },
    });
    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);
    if (session.role !== "SUPER_ADMIN") {
      const access = await canBusinessOperate(business.id);
      if (!access.canManageProducts) {
        return jsonError(access.reason || "Загрузка файлов временно недоступна.", 403);
      }
    }

    const uploaded = await uploadImageToSupabaseStorage({
      file,
      bucket: bucketForUploadType(type),
      folder: business.slug,
    });

    return NextResponse.json({ ok: true, url: uploaded.publicUrl, publicUrl: uploaded.publicUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Upload business lookup failed while Business.isDemo is missing", error);
    }
    return NextResponse.json({ error: publicUploadErrorMessage(error) }, { status: 500 });
  }
}
