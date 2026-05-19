import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, jsonError } from "@/lib/admin-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) return jsonError("Нужен вход в админку.", 401);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const size = file.size;
    const type = file.type;

    const isImage = type.startsWith("image/");
    const isVideo = type.startsWith("video/");

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Разрешены только изображения и видео." }, { status: 400 });
    }

    if (isImage && size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Изображение не должно превышать 5MB." }, { status: 400 });
    }

    if (isVideo && size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Видео не должно превышать 25MB." }, { status: 400 });
    }

    // Generate safe unique filename
    const ext = path.extname(file.name) || (isImage ? ".png" : ".mp4");
    const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    
    // Ensure public/uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch {}

    const filePath = path.join(uploadsDir, uniqueName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;
    return NextResponse.json({ ok: true, url: fileUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Ошибка загрузки." }, { status: 500 });
  }
}
