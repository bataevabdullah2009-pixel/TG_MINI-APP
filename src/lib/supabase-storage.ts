import crypto from "crypto";
import path from "path";

export const uploadImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const uploadBuckets = {
  businessMedia: "business-media",
  productImages: "product-images",
  businessCovers: "business-covers",
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

export function bucketForUploadType(type: string) {
  if (type === "logo") return process.env.SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET || uploadBuckets.businessMedia;
  if (type === "cover") return process.env.SUPABASE_STORAGE_BUSINESS_COVERS_BUCKET || uploadBuckets.businessCovers;
  return process.env.SUPABASE_STORAGE_PRODUCT_IMAGES_BUCKET || uploadBuckets.productImages;
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

export async function uploadImageToSupabaseStorage({ file, bucket, folder }: UploadOptions) {
  assertUploadImage(file);

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
