import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import {
  bucketForUploadType,
  normalizePaymentProofMimeType,
  publicUploadErrorMessage,
  uploadPaymentProofToSupabaseStorage,
} from "@/lib/supabase-storage";

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (!initData) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const businessValue = String(form.get("businessId") || form.get("businessSlug") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Файл чека не передан." }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessValue }, { slug: businessValue }] },
      select: { id: true, slug: true, transferPaymentEnabled: true },
    });

    if (!business) {
      return NextResponse.json({ ok: false, error: "Бизнес не найден." }, { status: 404 });
    }
    if (!business.transferPaymentEnabled) {
      return NextResponse.json({ ok: false, error: "Оплата переводом сейчас недоступна." }, { status: 400 });
    }

    const session = await getTelegramSessionUser(initData, business.id);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Нужна авторизация через Telegram." }, { status: 401 });
    }

    const mimeType = normalizePaymentProofMimeType(file);
    const uploaded = await uploadPaymentProofToSupabaseStorage({
      file,
      bucket: bucketForUploadType("payment-proof"),
      folder: `${business.slug}/payment-proofs`,
    });

    await prisma.mediaAsset.create({
      data: {
        businessId: business.id,
        type: "payment-proof",
        url: uploaded.publicUrl,
        filename: uploaded.filename,
        mimeType,
        size: file.size,
      },
    }).catch((error) => {
      console.warn("[PAYMENT PROOF UPLOAD] File uploaded, but MediaAsset log could not be saved:", error);
    });

    return NextResponse.json({
      ok: true,
      url: uploaded.publicUrl,
      publicUrl: uploaded.publicUrl,
      fileName: file.name,
      mimeType,
    });
  } catch (error) {
    console.error("POST /api/orders/payment-proof failed:", error);
    const message = publicUploadErrorMessage(error);
    const status = /Чек должен быть|Файл чека должен быть|Файл не похож/.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
