"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Trash2, Upload } from "lucide-react";

type Business = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor?: string | null;
};
type Asset = { id: string; type: string; url: string; filename: string; mimeType: string; size: number; createdAt: string };

const types = [
  ["logo", "Логотип"],
  ["cover", "Обложка"],
  ["product", "Фото товара"],
  ["service", "Фото услуги"],
  ["master", "Фото мастера"],
  ["banner", "Баннер акции"],
  ["gallery", "Галерея"],
  ["video", "Видео"],
];

export default function MediaPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [type, setType] = useState("gallery");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/media");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить медиа.");
      setAssets(data.data || []);
      setBusiness(data.business || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File) {
    if (!business) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      form.append("businessId", business.id);
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить файл.");
      const uploadedUrl = data.data?.url || data.imageUrl || data.url;
      setAssets((current) => [data.data, ...current]);
      if (uploadedUrl && (type === "logo" || type === "cover")) {
        setBusiness((current) =>
          current
            ? {
                ...current,
                ...(type === "logo" ? { logoUrl: uploadedUrl } : { coverImageUrl: uploadedUrl }),
              }
            : current
        );
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Не удалось удалить файл.");
      return;
    }
    setAssets((current) => current.filter((asset) => asset.id !== id));
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-slate-500">Назад в панель</Link>
            <h1 className="text-2xl font-black">Медиа</h1>
          </div>
          <p className="text-sm font-bold text-slate-500">{business?.name}</p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6">
        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {business && (
          <div className="mb-6 rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-400">Текущее оформление</h2>
            <div className="grid gap-4 md:grid-cols-[140px_1fr_140px]">
              <div>
                <p className="mb-2 text-xs font-black text-slate-500">Логотип</p>
                <div className="aspect-square overflow-hidden rounded-2xl border bg-slate-50">
                  {business.logoUrl ? (
                    <img src={business.logoUrl} alt={business.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center px-3 text-center text-xs font-bold text-slate-400">Не загружен</div>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black text-slate-500">Обложка</p>
                <div className="aspect-video overflow-hidden rounded-2xl border bg-slate-50">
                  {business.coverImageUrl ? (
                    <img src={business.coverImageUrl} alt={business.name} className="h-full w-full object-cover object-center" />
                  ) : (
                    <div className="grid h-full place-items-center px-3 text-center text-xs font-bold text-slate-400">Не загружена</div>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black text-slate-500">Brand color</p>
                <div className="flex h-full min-h-24 items-center gap-3 rounded-2xl border bg-slate-50 p-3">
                  <span className="h-10 w-10 shrink-0 rounded-xl border" style={{ backgroundColor: business.primaryColor || "#3B82F6" }} />
                  <span className="min-w-0 text-xs font-black uppercase text-slate-600">{business.primaryColor || "#3B82F6"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <label className="text-sm font-bold">
              <span className="mb-2 block">Тип файла</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border px-4 py-3">
                {types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-black text-slate-700">
              <Upload size={20} />
              {uploading ? "Загрузка..." : "Загрузить фото или видео"}
              <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Изображения: jpg, png, webp до 5 МБ. Видео: mp4, webm до 50 МБ. Логотип и обложка сразу применяются к бизнесу.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Загрузка...</div>
        ) : assets.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <ImagePlus className="mx-auto mb-3 text-slate-300" size={44} />
            <h2 className="font-black">Медиа пока нет</h2>
            <p className="mt-1 text-sm text-slate-500">Загрузите логотип, обложку или фото товара.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="h-48 bg-slate-100">
                  {asset.mimeType.startsWith("video/") ? (
                    <video src={asset.url} className="h-full w-full object-cover" controls />
                  ) : (
                    <img src={asset.url} alt={asset.filename} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{asset.filename}</p>
                    <p className="text-xs text-slate-500">{types.find(([value]) => value === asset.type)?.[1] || asset.type}</p>
                  </div>
                  <button onClick={() => remove(asset.id)} className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
