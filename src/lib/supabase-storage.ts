import crypto from "crypto";
import path from "path";

export const uploadImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const uploadBuckets = {
  businessMedia: "business-media",
} as const;

type UploadOptions = {
  file: File;
  bucket: string;
  folder: string;
};

function requireSupabaseStorageEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Supabase Storage не настроен. Проверьте NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey };
}

function cleanPathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "file";
}

export function assertUploadImage(file: File) {
  if (!uploadImageTypes.has(file.type)) {
    throw new Error("Можно загрузить только PNG, JPG, JPEG или WEBP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Изображение должно быть до 5MB.");
  }
}

export function assertUploadPdf(file: File) {
  if (file.type !== "application/pdf") {
    throw new Error("Чек перевода должен быть в PDF формате.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("PDF-чек должен быть до 10 MB.");
  }
}

export function publicUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("Можно загрузить") ||
    message.startsWith("Изображение должно") ||
    message.startsWith("Чек перевода должен") ||
    message.startsWith("PDF-чек должен") ||
    message.startsWith("Supabase Storage не настроен")
  ) {
    return message;
  }
  if (message.startsWith("Не удалось подготовить bucket")) {
    return "Не удалось подготовить Supabase Storage. Создайте публичный bucket business-media или проверьте SUPABASE_SERVICE_ROLE_KEY.";
  }
  return "Не удалось загрузить файл. Проверьте формат и размер файла, затем попробуйте снова.";
}

export function bucketForUploadType(type: string) {
  return process.env.SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET || uploadBuckets.businessMedia;
}

async function ensureBucket(supabaseUrl: string, serviceRoleKey: string, bucket: string) {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (response.ok) return;

  const createResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: bucket, name: bucket, public: true }),
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    const message = await createResponse.text();
    throw new Error(`Не удалось подготовить bucket ${bucket}: ${message}`);
  }
}

async function uploadFileToSupabaseStorage({ file, bucket, folder }: UploadOptions) {
  const { supabaseUrl, serviceRoleKey } = requireSupabaseStorageEnv();
  await ensureBucket(supabaseUrl, serviceRoleKey, bucket);

  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  const base = cleanPathPart(path.basename(file.name, ext));
  const storagePath = `${cleanPathPart(folder)}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${base}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const message = await uploadResponse.text();
    throw new Error(`Не удалось загрузить файл в Supabase Storage: ${message}`);
  }

  return {
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`,
    filename: storagePath,
  };
}

export async function uploadImageToSupabaseStorage(options: UploadOptions) {
  assertUploadImage(options.file);
  return uploadFileToSupabaseStorage(options);
}

export async function uploadPdfToSupabaseStorage(options: UploadOptions) {
  assertUploadPdf(options.file);
  const signature = Buffer.from(await options.file.slice(0, 5).arrayBuffer()).toString("ascii");
  if (signature !== "%PDF-") {
    throw new Error("Чек перевода должен быть настоящим PDF-файлом.");
  }
  return uploadFileToSupabaseStorage(options);
}
