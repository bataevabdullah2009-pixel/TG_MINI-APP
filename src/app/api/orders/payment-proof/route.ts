import { NextRequest, NextResponse } from "next/server";
import { getTelegramSessionUser } from "@/lib/auth-telegram";
import { prisma } from "@/lib/prisma";
import {
  bucketForUploadType,
  normalizePaymentProofMimeType,
  publicUploadErrorMessage,
  uploadPaymentProofToSupabaseStorage,
} from "@/lib/supabase-storage";

function uploadErrorStatus(message: string) {
  if (
    message.includes("формате JPG") ||
    message.includes("10 MB") ||
    message.includes("не похож") ||
    message.includes("настоящий JPG") ||
    message.includes("настоящим PDF")
  ) {
    return 400;
  }
  if (message.includes("Ошибка storage") || message.includes("Supabase Storage")) {
    return 502;
  }
  return 500;
}

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
    if (!businessValue) {
      return NextResponse.json({ ok: false, error: "Бизнес для загрузки чека не выбран." }, { status: 400 });
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
    console.info("[PAYMENT_PROOF_UPLOAD]", {
      businessId: business.id,
      fileName: file.name,
      mimeType,
      size: file.size,
    });
    const uploaded = await uploadPaymentProofToSupabaseStorage({
      file,
      bucket: bucketForUploadType("payment-proof"),
      folder: business.slug,
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
    return NextResponse.json({ ok: false, error: message }, { status: uploadErrorStatus(message) });
  }
}
