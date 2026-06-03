"use client";

import React from "react";
import { Business } from "@/types";
import { formatPrice } from "@/lib/utils";

interface BusinessHeaderProps {
  business: Business;
}

export function BusinessHeader({ business }: BusinessHeaderProps) {
  return (
    <div
      className="relative aspect-[16/9] max-h-56 min-h-40 rounded-b-3xl overflow-hidden"
      style={{ backgroundColor: business.backgroundColor }}
    >
      {/* Cover Image */}
      <div className="absolute inset-0 w-full h-full">
        {business.coverImageUrl && (
          <img
            src={business.coverImageUrl}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        )}
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundColor: business.primaryColor }}
        />
      </div>

      {/* Logo and Name */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
        {business.logoUrl && (
          <img
            src={business.logoUrl}
            alt={business.name}
            className="w-16 h-16 rounded-xl border-4 border-white object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{business.name}</h1>
          {business.description && (
            <p className="text-sm text-white/80 line-clamp-2">{business.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function BusinessInfo({ business }: BusinessHeaderProps) {
  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {business.phone && (
        <a
          href={`tel:${business.phone}`}
          className="p-3 rounded-lg text-center text-sm hover:bg-muted transition"
          style={{ backgroundColor: business.backgroundColor }}
        >
          <div className="text-lg">📱</div>
          <div className="font-semibold">Звонок</div>
        </a>
      )}
      {business.whatsappUrl && (
        <a
          href={business.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-lg text-center text-sm hover:bg-muted transition"
          style={{ backgroundColor: business.backgroundColor }}
        >
          <div className="text-lg">💬</div>
          <div className="font-semibold">WhatsApp</div>
        </a>
      )}
      {business.telegramUrl && (
        <a
          href={business.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-lg text-center text-sm hover:bg-muted transition"
          style={{ backgroundColor: business.backgroundColor }}
        >
          <div className="text-lg">✈️</div>
          <div className="font-semibold">Telegram</div>
        </a>
      )}
    </div>
  );
}
