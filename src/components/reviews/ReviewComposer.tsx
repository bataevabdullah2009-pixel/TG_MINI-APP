"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";

type ReviewComposerProps = {
  businessSlug: string;
  orderId?: string;
  bookingId?: string;
  onCreated: (review: { id: string; rating: number; status: string }) => void;
};

export function ReviewComposer({
  businessSlug,
  orderId,
  bookingId,
  onCreated,
}: ReviewComposerProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await miniAppFetch(
        `/api/businesses/${encodeURIComponent(businessSlug)}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({ rating, comment, orderId, bookingId }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось сохранить отзыв.");
      }
      onCreated(data.review);
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить отзыв.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="mt-3 w-full rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800 ring-1 ring-amber-200"
      >
        Оставить отзыв
      </button>
    );
  }

  return (
    <div
      className="mt-3 space-y-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200"
      onClick={(event) => event.stopPropagation()}
    >
      <div>
        <p className="text-xs font-black text-slate-900">Оцените заведение</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} из 5`}
              onClick={() => setRating(value)}
              className="rounded-lg p-1"
            >
              <Star
                size={22}
                className={value <= rating ? "text-amber-500" : "text-slate-300"}
                fill={value <= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value.slice(0, 1000))}
        rows={3}
        placeholder="Комментарий необязателен"
        className="w-full resize-none rounded-xl border border-amber-200 bg-white p-3 text-xs outline-none"
      />

      {error && <p className="text-[11px] font-bold text-rose-700">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {submitting ? "Сохраняем..." : "Отправить"}
        </button>
      </div>
    </div>
  );
}
