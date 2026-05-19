"use client";

import React, { useState, useRef } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

interface MediaUploadProps {
  businessId: string;
  type?: "logo" | "cover" | "gallery";
  initialUrl?: string;
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
}

export function MediaUpload({
  businessId,
  type = "gallery",
  initialUrl = "",
  onUploadComplete,
  onRemove,
}: MediaUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("businessId", businessId);

    try {
      const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData : "";
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          ...(initData ? { "x-telegram-init-data": initData } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось загрузить файл");
      }

      setPreviewUrl(data.imageUrl);
      onUploadComplete(data.imageUrl);
    } catch (err: any) {
      console.error("[MediaUpload] upload failed:", err);
      setError(err.message || "Ошибка при отправке файла");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onRemove) onRemove();
    else onUploadComplete("");
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative group rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 aspect-video flex items-center justify-center shadow-sm">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onButtonClick}
              disabled={loading}
              className="bg-white/90 text-slate-800 font-extrabold text-xs px-3.5 py-1.5 rounded-xl hover:bg-white active:scale-95 transition-all shadow-md"
            >
              Заменить
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="bg-rose-600/90 text-white font-extrabold text-xs p-2 rounded-xl hover:bg-rose-650 active:scale-95 transition-all shadow-md"
            >
              <X size={14} />
            </button>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
              <span className="text-[10px] font-black text-slate-600 mt-2">ОБНОВЛЕНИЕ...</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          disabled={loading}
          className={`w-full py-6 px-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/30"
              : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350"
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center py-2">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
              <span className="text-xs font-bold text-slate-500 mt-2">Загрузка файла...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 mb-2">
                <Upload size={16} />
              </span>
              <p className="text-xs font-black text-slate-700">Нажмите или перетащите фото</p>
              <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                PNG, JPG, WEBP до 5 МБ
              </p>
            </div>
          )}
        </button>
      )}

      {error && (
        <p className="text-rose-600 text-[10px] font-extrabold mt-1.5">⚠️ {error}</p>
      )}
    </div>
  );
}
