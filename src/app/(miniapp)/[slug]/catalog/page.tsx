"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ItemCard, ItemCardSkeleton } from "@/components/mini-app/ItemCard";
import { BottomNavigation } from "@/components/mini-app/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Business, Item, Category } from "@/types";
import { apiClient } from "@/lib/api-client";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

export default function CatalogPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc" | "popular">("default");

  const addToCart = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  useEffect(() => {
    async function fetchData() {
      try {
        const [businessRes, itemsRes] = await Promise.all([
          apiClient.get(`/businesses/${slug}`),
          apiClient.get(`/items/${slug}`),
        ]);
        setBusiness(businessRes.data);
        const itemsList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
        setItems(itemsList);

        // Extract unique categories from items
        const uniqueCategories = new Map<string, Category>();
        itemsList.forEach((item: Item & { category?: Category }) => {
          if (item.categoryId && item.category) {
            uniqueCategories.set(item.categoryId, item.category);
          }
        });
        setCategories(Array.from(uniqueCategories.values()));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [slug]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((item) => item.categoryId === selectedCategory);
    }

    // Sort
    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "popular":
        result.sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0));
        break;
      default:
        result.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return result;
  }, [items, searchQuery, selectedCategory, sortBy]);

  const handleAddToCart = (item: Item) => {
    addToCart({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      image: item.imageUrl || undefined,
    });
  };

  const handleViewDetails = (item: Item) => {
    router.push(`/${slug}/item/${item.id}`);
  };

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  if (loading) {
    return (
      <div className="pb-20">
        <div className="p-4 bg-white border-b sticky top-0 z-10">
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-3" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
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
          <Link href="/">
            <Button variant="outline">На главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">📦 Каталог</h1>
            <Link href={`/${slug}/cart`} className="relative">
              <span className="text-2xl">🛒</span>
              {cartCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                  style={{ backgroundColor: business.accentColor }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Input
              type="text"
              placeholder="🔍 Поиск товаров..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-3 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Categories Scroll */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  !selectedCategory
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={{
                  backgroundColor: !selectedCategory ? business.primaryColor : undefined,
                }}
              >
                Все
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? "text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: selectedCategory === cat.id ? business.primaryColor : undefined,
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Sort */}
          <div className="flex gap-2 mt-2">
            {[
              { key: "default" as const, label: "По умолчанию" },
              { key: "price_asc" as const, label: "Дешевле" },
              { key: "price_desc" as const, label: "Дороже" },
              { key: "popular" as const, label: "⭐ Популярные" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setSortBy(option.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  sortBy === option.key
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="px-4 py-2 text-sm text-muted-foreground">
        {searchQuery && (
          <span>
            Найдено: {filteredItems.length} {filteredItems.length === 1 ? "товар" : "товаров"}
          </span>
        )}
        {!searchQuery && (
          <span>
            Всего: {filteredItems.length} {filteredItems.length === 1 ? "товар" : "товаров"}
          </span>
        )}
      </div>

      {/* Items Grid */}
      <div className="p-4 pt-0">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-lg font-semibold mb-2">Ничего не найдено</p>
            <p className="text-muted-foreground text-sm mb-4">
              Попробуйте изменить поиск или фильтры
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory(null);
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                primaryColor={business.primaryColor}
                accentColor={business.accentColor}
                onAddToCart={() => handleAddToCart(item)}
                onViewDetails={() => handleViewDetails(item)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNavigation businessSlug={slug} primaryColor={business.primaryColor} />
    </div>
  );
}
