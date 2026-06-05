import crypto from "crypto";
import path from "path";

export const uploadImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const paymentProofTypes = new Set([...uploadImageTypes, "application/pdf"]);
export const uploadBuckets = {
  businessMedia: "business-media",
  paymentProofs: "payment-proofs",
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

export function normalizePaymentProofMimeType(file: File) {
  const declaredType = file.type.trim().toLowerCase();
  if (paymentProofTypes.has(declaredType)) return declaredType === "image/jpg" ? "image/jpeg" : declaredType;

  const ext = path.extname(file.name).toLowerCase();
  const byExtension: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };
  return byExtension[ext] || "";
}

export function assertUploadPaymentProof(file: File) {
  if (!normalizePaymentProofMimeType(file)) {
    throw new Error("Чек должен быть в формате JPG, JPEG, PNG, WEBP или PDF.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Файл чека должен быть до 10 MB.");
  }
}

export function publicUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("Можно загрузить") ||
    message.startsWith("Изображение должно") ||
    message.startsWith("Чек перевода должен") ||
    message.startsWith("PDF-чек должен") ||
    message.startsWith("Чек должен быть") ||
    message.startsWith("Файл чека должен быть") ||
    message.startsWith("Файл не похож на") ||
    message.startsWith("Supabase Storage не настроен")
  ) {
    return message;
  }
  if (message.startsWith("Не удалось подготовить bucket")) {
    return "Не удалось подготовить Supabase Storage. Проверьте storage bucket и SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (message.startsWith("Supabase Storage error:")) {
    return `Ошибка storage: ${message.replace("Supabase Storage error:", "").trim()}`;
  }
  return "Не удалось загрузить файл. Проверьте формат и размер файла, затем попробуйте снова.";
}

export function bucketForUploadType(type: string) {
  if (type === "payment-proof") {
    return process.env.SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET || uploadBuckets.paymentProofs;
  }
  return process.env.SUPABASE_STORAGE_BUSINESS_MEDIA_BUCKET || uploadBuckets.businessMedia;
}

export async function diagnoseSupabaseStorageBucket(bucket = bucketForUploadType("payment-proof")) {
  try {
    const { supabaseUrl, serviceRoleKey } = requireSupabaseStorageEnv();
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (response.ok) return { ok: true as const, bucket };
    const responsePreview = (await response.text()).slice(0, 300);
    return {
      ok: false as const,
      bucket,
      status: response.status,
      error: response.status === 404 ? `Storage bucket "${bucket}" is missing.` : `Storage bucket "${bucket}" is unavailable.`,
      responsePreview,
    };
  } catch (error) {
    return {
      ok: false as const,
      bucket,
      error: error instanceof Error ? error.message : "Supabase Storage diagnostic failed.",
    };
  }
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
    console.error("[SUPABASE STORAGE] bucket unavailable", {
      bucket,
      status: createResponse.status,
      responsePreview: message.slice(0, 500),
    });
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
    console.error("[SUPABASE STORAGE] upload failed", {
      bucket,
      storagePath,
      status: uploadResponse.status,
      responsePreview: message.slice(0, 500),
    });
    throw new Error(`Supabase Storage error: ${message.slice(0, 500)}`);
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

export async function uploadPaymentProofToSupabaseStorage(options: UploadOptions) {
  assertUploadPaymentProof(options.file);
  const mimeType = normalizePaymentProofMimeType(options.file);
  const header = Buffer.from(await options.file.slice(0, 16).arrayBuffer());
  const isPdf = header.subarray(0, 5).toString("ascii") === "%PDF-";
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP";
  const signatureMatches =
    (mimeType === "application/pdf" && isPdf) ||
    (mimeType === "image/jpeg" && isJpeg) ||
    (mimeType === "image/png" && isPng) ||
    (mimeType === "image/webp" && isWebp);

  if (!signatureMatches) {
    throw new Error("Файл не похож на настоящий JPG, PNG, WEBP или PDF.");
  }

  return uploadFileToSupabaseStorage({
    ...options,
    file: new File([await options.file.arrayBuffer()], options.file.name, { type: mimeType }),
  });
}
