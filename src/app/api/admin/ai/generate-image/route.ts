import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";
import { PolzaMediaProvider } from "@/lib/ai/polza-media-provider";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const body = await request.json();
    const { prompt, businessId } = body;

    if (!prompt) return jsonError("Промпт для изображения не передан.", 400);

    const businessValue = businessId || session.businessId || "";
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessValue }, { slug: businessValue }] },
    });

    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const apiKey = process.env.POLZA_AI_API_KEY;
    if (!apiKey) {
      return jsonError("API-ключ Polza AI (POLZA_AI_API_KEY) отсутствует в конфигурации сервера.", 400);
    }

    const provider = new PolzaMediaProvider(
      apiKey,
      process.env.POLZA_IMAGE_MODEL || "google/gemini-3.1-flash-image-preview"
    );

    const result = await provider.generatePromoImage({
      prompt,
      aspectRatio: "1:1",
      resolution: "1K",
      businessId: business.id,
    });

    if (result.status === "error" || !result.url) {
      return jsonError(result.error || "Не удалось сгенерировать изображение через Polza AI.", 500);
    }

    // Download generated image from provider's URL
    const imageRes = await fetch(result.url);
    if (!imageRes.ok) {
      return jsonError("Не удалось скачать сгенерированное изображение с сервера Polza AI.", 500);
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate safe filename
    const cleanPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "-");
    const filename = `ai-gen-${cleanPrompt}-${Date.now()}.png`;
    let fileUrl = "";
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      // Vercel Blob cloud upload
      const blobResponse = await fetch(`https://blob.vercel-storage.com/${filename}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "x-api-version": "6",
        },
        body: buffer,
      });

      if (!blobResponse.ok) {
        const errorText = await blobResponse.text();
        console.error("Vercel Blob upload REST API failed during AI Image save:", errorText);
        return jsonError("Не удалось сохранить изображение в облако Vercel Blob.", 500);
      }

      const blobData = await blobResponse.json();
      fileUrl = blobData.url;
    } else {
      // Fallback: local public/uploads for development
      const relativeDir = `/uploads/${business.slug}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", business.slug);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      fileUrl = `${relativeDir}/${filename}`;
    }

    // Save image asset in DB
    const asset = await prisma.mediaAsset.create({
      data: {
        businessId: business.id,
        type: "product_ai",
        url: fileUrl,
        filename,
        mimeType: "image/png",
        size: buffer.length,
      },
    });

    return NextResponse.json({ ok: true, data: asset }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/ai/generate-image failed:", error);
    return jsonError(error.message || "Не удалось сгенерировать или сохранить фото.", 500);
  }
}
