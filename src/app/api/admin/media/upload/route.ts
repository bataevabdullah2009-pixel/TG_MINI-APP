import { NextRequest, NextResponse } from "next/server";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bucketForUploadType, publicUploadErrorMessage, uploadImageToSupabaseStorage } from "@/lib/supabase-storage";
import { isBusinessIsDemoMissingColumnError, warnPrismaSchemaDrift } from "@/lib/prisma-schema-guard";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const form = await request.formData();
    const file = form.get("file");
    const type = String(form.get("type") || "gallery");
    const businessValue = String(form.get("businessId") || form.get("businessSlug") || session.businessId || "");
    const itemId = String(form.get("itemId") || form.get("productId") || "");

    if (!(file instanceof File)) return jsonError("Файл не передан.", 400);

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessValue }, { slug: businessValue }] },
      select: { id: true, slug: true },
    });
    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const uploaded = await uploadImageToSupabaseStorage({
      file,
      bucket: bucketForUploadType(type),
      folder: business.slug,
    });

    const asset = await prisma.mediaAsset.create({
      data: {
        businessId: business.id,
        type,
        url: uploaded.publicUrl,
        filename: uploaded.filename,
        mimeType: file.type,
        size: file.size,
      },
    });

    if (type === "logo") {
      await prisma.business.update({ where: { id: business.id }, data: { logoUrl: asset.url }, select: { id: true } });
    }
    if (type === "cover") {
      await prisma.business.update({ where: { id: business.id }, data: { coverImageUrl: asset.url }, select: { id: true } });
    }
    if (itemId && (type === "product" || type === "service" || type === "item")) {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (!item || !canUseBusiness(session, item.businessId)) return jsonError("Нет доступа к этой позиции.", 403);
      await prisma.item.update({ where: { id: itemId }, data: { imageUrl: asset.url } });
    }

    return NextResponse.json({ ok: true, url: asset.url, imageUrl: asset.url, publicUrl: asset.url, data: asset }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/media/upload failed:", error);
    if (isBusinessIsDemoMissingColumnError(error)) {
      warnPrismaSchemaDrift("Admin media upload failed while Business.isDemo is missing", error);
    }
    return jsonError(publicUploadErrorMessage(error), 500);
  }
}
