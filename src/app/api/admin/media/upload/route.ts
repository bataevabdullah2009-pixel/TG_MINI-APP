import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canUseBusiness, getAdminSession, jsonError } from "@/lib/admin-auth";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm"]);
const blockedExtensions = new Set([".exe", ".js", ".html", ".htm", ".php", ".bat", ".cmd", ".ps1"]);

function cleanName(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "-").slice(0, 48) || "file";
  return `${base}-${Date.now()}${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const form = await request.formData();
    const file = form.get("file");
    const type = String(form.get("type") || "gallery");
    const businessValue = String(form.get("businessId") || form.get("businessSlug") || session.businessId || "");

    if (!(file instanceof File)) return jsonError("Файл не передан.", 400);
    const ext = path.extname(file.name).toLowerCase();
    if (blockedExtensions.has(ext)) return jsonError("Этот тип файла запрещён.", 400);

    const isImage = imageTypes.has(file.type);
    const isVideo = videoTypes.has(file.type);
    if (!isImage && !isVideo) return jsonError("Можно загрузить только jpg, png, webp, mp4 или webm.", 400);
    if (isImage && file.size > 5 * 1024 * 1024) return jsonError("Изображение должно быть до 5 МБ.", 400);
    if (isVideo && file.size > 50 * 1024 * 1024) return jsonError("Видео должно быть до 50 МБ.", 400);

    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessValue }, { slug: businessValue }] },
    });
    if (!business) return jsonError("Бизнес не найден.", 404);
    if (!canUseBusiness(session, business.id)) return jsonError("Нет доступа к этому бизнесу.", 403);

    const filename = cleanName(file.name);
    const relativeDir = `/uploads/${business.slug}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", business.slug);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

    const asset = await prisma.mediaAsset.create({
      data: {
        businessId: business.id,
        type,
        url: `${relativeDir}/${filename}`,
        filename,
        mimeType: file.type,
        size: file.size,
      },
    });

    if (type === "logo") {
      await prisma.business.update({ where: { id: business.id }, data: { logoUrl: asset.url } });
    }
    if (type === "cover") {
      await prisma.business.update({ where: { id: business.id }, data: { coverImageUrl: asset.url } });
    }

    return NextResponse.json({ ok: true, data: asset }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/media/upload failed:", error);
    return jsonError("Не удалось загрузить файл.", 500);
  }
}
