"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Business } from "@/types";
import { apiClient } from "@/lib/api-client";
import { BottomNavigation } from "@/components/mini-app/BottomNavigation";
import Link from "next/link";

const DAYS_RU = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

interface WorkingHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface BusinessFull extends Omit<Business, "workingHours"> {
  workingHours?: WorkingHours[];
}

export default function ContactsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [business, setBusiness] = useState<BusinessFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await apiClient.get(`/businesses/${slug}`);
        setBusiness(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!business) return null;

  const primaryColor = business.primaryColor;
  const today = new Date().getDay();

  const sortedHours = business.workingHours
    ? [...business.workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    : [];

  const todayHours = sortedHours.find((h) => h.dayOfWeek === today);
  const isOpenNow = todayHours && !todayHours.isClosed;

  const mapUrl = business.address
    ? `https://maps.google.com/?q=${encodeURIComponent(business.address)}`
    : null;

  return (
    <div className="pb-24">
      {/* Hero */}
      <div
        className="p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${business.accentColor})` }}
      >
        <button onClick={() => router.back()} className="text-white/80 text-sm mb-3 block">
          ← Назад
        </button>
        {business.logoUrl && (
          <img
            src={business.logoUrl}
            alt={business.name}
            className="w-16 h-16 rounded-2xl border-4 border-white/30 mb-3 object-cover"
          />
        )}
        <h1 className="text-2xl font-bold">{business.name}</h1>
        {business.description && (
          <p className="text-white/80 text-sm mt-1 leading-relaxed">{business.description}</p>
        )}

        {/* Open/Closed Badge */}
        <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full">
          <span
            className={`w-2 h-2 rounded-full ${isOpenNow ? "bg-green-300" : "bg-red-300"}`}
          />
          <span className="text-sm font-medium">
            {isOpenNow
              ? `Открыто · до ${todayHours.closeTime}`
              : "Закрыто"}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">📞</span>
              <div>
                <p className="text-xs text-muted-foreground">Позвонить</p>
                <p className="font-semibold text-sm">{business.phone}</p>
              </div>
            </a>
          )}

          {business.telegramUrl && (
            <a
              href={business.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">✈️</span>
              <div>
                <p className="text-xs text-muted-foreground">Telegram</p>
                <p className="font-semibold text-sm">Написать</p>
              </div>
            </a>
          )}

          {business.whatsappUrl && (
            <a
              href={business.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="font-semibold text-sm">Написать</p>
              </div>
            </a>
          )}

          {business.instagramUrl && (
            <a
              href={business.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">📸</span>
              <div>
                <p className="text-xs text-muted-foreground">Instagram</p>
                <p className="font-semibold text-sm">Подписаться</p>
              </div>
            </a>
          )}
        </div>

        {/* Address */}
        {business.address && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4">
              <h2 className="font-bold mb-1 flex items-center gap-2">
                <span>📍</span> Адрес
              </h2>
              <p className="text-sm text-muted-foreground">{business.address}</p>
            </div>
            {mapUrl && (
              <>
                {/* Simple map placeholder with link */}
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative h-40 overflow-hidden bg-gray-100"
                >
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <span className="text-4xl">🗺️</span>
                    <span
                      className="text-sm font-semibold px-4 py-2 rounded-full text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Открыть в картах →
                    </span>
                  </div>
                </a>
              </>
            )}
          </div>
        )}

        {/* Working Hours */}
        {sortedHours.length > 0 && (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <span>🕐</span> Режим работы
            </h2>
            <div className="space-y-2">
              {sortedHours.map((h) => {
                const isToday = h.dayOfWeek === today;
                return (
                  <div
                    key={h.dayOfWeek}
                    className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${
                      isToday ? "font-semibold" : ""
                    }`}
                    style={isToday ? { backgroundColor: `${primaryColor}15` } : {}}
                  >
                    <span className={isToday ? "" : "text-muted-foreground"}>
                      {isToday && (
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                      {DAYS_RU[h.dayOfWeek]}
                    </span>
                    <span className={h.isClosed ? "text-red-500" : isToday ? "" : "text-muted-foreground"}>
                      {h.isClosed ? "Выходной" : `${h.openTime} – ${h.closeTime}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Email */}
        {business.email && (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-bold mb-1 flex items-center gap-2">
              <span>📧</span> Email
            </h2>
            <a
              href={`mailto:${business.email}`}
              className="text-sm"
              style={{ color: primaryColor }}
            >
              {business.email}
            </a>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link href={`/${slug}/catalog`}>
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm border-2"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              📦 Каталог
            </button>
          </Link>
          <Link href={`/${slug}/booking`}>
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm text-white"
              style={{ backgroundColor: primaryColor }}
            >
              📅 Записаться
            </button>
          </Link>
        </div>
      </div>

      <BottomNavigation businessSlug={slug} primaryColor={primaryColor} />
    </div>
  );
}
