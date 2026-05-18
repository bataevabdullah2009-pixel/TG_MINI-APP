"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BusinessHeader, BusinessInfo } from "@/components/mini-app/BusinessHeader";
import { ItemCard, ItemCardSkeleton } from "@/components/mini-app/ItemCard";
import { BottomNavigation } from "@/components/mini-app/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Business, Item } from "@/types";
import { apiClient } from "@/lib/api-client";

export default function BusinessPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [businessRes, itemsRes] = await Promise.all([
          apiClient.get(`/businesses/${slug}`),
          apiClient.get(`/items/${slug}`),
        ]);

        setBusiness(businessRes.data);
        setItems(itemsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4 p-4 pb-20">
        <div className="h-48 bg-muted rounded-b-3xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl font-semibold mb-4">Бизнес не найден</p>
          <Button variant="outline">Вернуться</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <BusinessHeader business={business} />
      <BusinessInfo business={business} />

      {/* Popular Items Section */}
      {items.filter((i) => i.isPopular).length > 0 && (
        <div className="p-4">
          <h2 className="text-lg font-bold mb-3">⭐ Популярные</h2>
          <div className="grid grid-cols-2 gap-3">
            {items
              .filter((i) => i.isPopular)
              .slice(0, 4)
              .map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  primaryColor={business.primaryColor}
                  accentColor={business.accentColor}
                />
              ))}
          </div>
        </div>
      )}

      {/* All Items */}
      <div className="p-4">
        <h2 className="text-lg font-bold mb-3">📦 Все товары</h2>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              primaryColor={business.primaryColor}
              accentColor={business.accentColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
