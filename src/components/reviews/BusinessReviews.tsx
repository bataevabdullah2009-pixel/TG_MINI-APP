"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { miniAppFetch } from "@/lib/miniAppFetch";
import {
  beginMiniAppQuery,
  readMiniAppQueryCache,
  writeMiniAppQueryCache,
} from "@/lib/miniAppQuery";

type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
};

type ReviewsPayload = {
  reviews: PublicReview[];
  rating: { average: number; count: number };
};

export function BusinessReviews({ businessSlug }: { businessSlug: string }) {
  const [payload, setPayload] = useState<ReviewsPayload>({
    reviews: [],
    rating: { average: 0, count: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryKey = ["business-reviews", businessSlug, 0, 10] as const;
    const request = beginMiniAppQuery(`business-reviews:${businessSlug}`, queryKey);
    const cached = readMiniAppQueryCache<ReviewsPayload>(queryKey);
    if (cached) {
      setPayload(cached);
      setLoading(false);
      request.finish();
      return () => request.cancel();
    }

    setLoading(true);
    setError("");
    miniAppFetch(`/api/businesses/${encodeURIComponent(businessSlug)}/reviews?limit=10`, {
      signal: request.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Отзывы временно недоступны.");
        }
        const nextPayload = {
          reviews: Array.isArray(data.reviews) ? data.reviews : [],
          rating: data.rating || { average: 0, count: 0 },
        };
        if (!request.isCurrent()) return;
        setPayload(nextPayload);
        writeMiniAppQueryCache(queryKey, nextPayload, 30_000);
      })
      .catch((loadError) => {
        if (!request.signal.aborted && request.isCurrent()) {
          setError(loadError instanceof Error ? loadError.message : "Отзывы временно недоступны.");
        }
      })
      .finally(() => {
        if (request.isCurrent()) setLoading(false);
        request.finish();
      });

    return () => request.cancel();
  }, [businessSlug]);

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Отзывы</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Что говорят клиенты</h2>
        </div>
        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-right ring-1 ring-amber-100">
          <div className="flex items-center justify-end gap-1 text-sm font-black text-amber-600">
            <Star size={15} fill="currentColor" />
            {payload.rating.count > 0 ? payload.rating.average.toFixed(1) : "—"}
          </div>
          <p className="text-[9px] font-bold text-slate-400">
            {payload.rating.count} {payload.rating.count === 1 ? "отзыв" : "отзывов"}
          </p>
        </div>
      </div>

      {loading && <p className="mt-4 text-xs font-bold text-slate-400">Загрузка отзывов...</p>}
      {!loading && error && <p className="mt-4 text-xs font-bold text-rose-600">{error}</p>}
      {!loading && !error && payload.reviews.length === 0 && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-center">
          <MessageSquareText className="mx-auto text-slate-300" size={28} />
          <p className="mt-2 text-xs font-bold text-slate-500">Пока нет отзывов.</p>
        </div>
      )}

      {!loading && !error && payload.reviews.length > 0 && (
        <div className="mt-4 space-y-3">
          {payload.reviews.map((review) => (
            <article key={review.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-xs text-slate-900">{review.authorName}</strong>
                <span className="flex items-center gap-1 text-[11px] font-black text-amber-600">
                  <Star size={12} fill="currentColor" />
                  {review.rating}
                </span>
              </div>
              {review.comment && (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{review.comment}</p>
              )}
              <time className="mt-2 block text-[9px] font-bold text-slate-400">
                {new Date(review.createdAt).toLocaleDateString("ru-RU")}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
