"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Item, Business } from "@/types";
import { apiClient } from "@/lib/api-client";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, getBusinessTypeLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const slug = params.slug as string;

  const [item, setItem] = useState<Item | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const addToCart = useCartStore((state) => state.addItem);

  // Fetch business и item
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Получить информацию о бизнесе
        const businessRes = await apiClient.get<Business>(
          `/businesses/${slug}`
        );
        if (!businessRes.data) throw new Error("Business not found");
        setBusiness(businessRes.data);

        // Получить товар - ищем по ID в списке товаров
        const itemsRes = await apiClient.get<Item[]>(
          `/items/${slug}`
        );
        if (!itemsRes.data) throw new Error("Items not found");

        const foundItem = itemsRes.data.find((i) => i.id === itemId);
        if (!foundItem) throw new Error("Item not found");

        setItem(foundItem);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load item");
        console.error("Error fetching item:", err);
      } finally {
        setLoading(false);
      }
    };

    if (slug && itemId) {
      fetchData();
    }
  }, [slug, itemId]);

  const handleAddToCart = () => {
    if (!item) return;

    addToCart({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: quantity,
      image: item.imageUrl || item.image || undefined,
      type: item.type,
    });

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    // Перейти на страницу checkout
    router.push(`/${slug}/checkout`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !item || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Товар не найден"}</p>
          <Link href={`/${slug}`}>
            <Button>Вернуться назад</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isService = item.type === "SERVICE";
  const hasDiscount = item.oldPrice && item.oldPrice > item.price;
  const discountPercent = hasDiscount
    ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)
    : 0;

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="text-2xl"
          >
            ← Назад
          </button>
          <h1 className="text-lg font-bold flex-1 text-center">{item.name}</h1>
          <div className="w-8"></div>
        </div>
      </div>

      {/* Item Image */}
      <div
        className="relative w-full aspect-square bg-gray-200"
        style={{ backgroundColor: business.backgroundColor || "#f5f5f5" }}
      >
        {item.imageUrl || item.image ? (
          <Image
            src={(item.imageUrl || item.image) as string}
            alt={item.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="text-6xl">📦</span>
          </div>
        )}

        {/* Badge: Popular */}
        {item.isPopular && (
          <div
            className="absolute top-3 right-3 px-3 py-1 rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: business.primaryColor }}
          >
            ⭐ Популярное
          </div>
        )}

        {/* Badge: Discount */}
        {hasDiscount && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold">
            -{discountPercent}%
          </div>
        )}
      </div>

      {/* Main Info */}
      <div className="p-4">
        {/* Name */}
        <h1 className="text-2xl font-bold mb-2">{item.name}</h1>

        {/* Rating / Meta */}
        <div className="flex items-center gap-3 mb-4 text-gray-600">
          {isService && item.duration && (
            <span className="text-sm">⏱️ {item.duration} мин</span>
          )}
          {!isService && item.stock !== null && (
            <span className="text-sm">📦 В наличии: {item.stock}</span>
          )}
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-bold"
              style={{ color: business.primaryColor }}
            >
              {formatPrice(item.price)}
            </span>
            {hasDiscount && (
              <span className="text-xl text-gray-400 line-through">
                {formatPrice(item.oldPrice)}
              </span>
            )}
          </div>
          {hasDiscount && (
            <p className="text-green-600 text-sm mt-1">
              Экономия: {formatPrice(item.oldPrice - item.price)}
            </p>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Описание</h3>
            <p className="text-gray-700 leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* Category */}
        {item.categoryId && (
          <div className="mb-6 pb-6 border-b">
            <p className="text-sm text-gray-600">
              Категория:{" "}
              <span className="font-semibold text-gray-900">
                {item.category?.name || "N/A"}
              </span>
            </p>
          </div>
        )}

        {/* Type Badge */}
        <div className="mb-6">
          <span
            className="inline-block px-3 py-1 rounded-full text-white text-sm font-semibold"
            style={{ backgroundColor: business.accentColor }}
          >
            {isService ? "🎯 Услуга" : "🛍️ Товар"}
          </span>
        </div>

        {/* Stock Warning */}
        {!isService && item.stock !== null && item.stock < 5 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm font-semibold">
              ⚠️ Осталось {item.stock} шт.
            </p>
          </div>
        )}

        {/* Quantity Selector */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Количество:</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-4 py-2 border rounded-lg text-lg font-bold"
            >
              −
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-16 py-2 text-center border rounded-lg text-lg font-bold"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-4 py-2 border rounded-lg text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <div className="max-w-full flex gap-2">
          <Button
            onClick={handleAddToCart}
            variant="outline"
            className="flex-1"
          >
            {addedToCart ? "✓ Добавлено" : "🛒 В корзину"}
          </Button>
          <Button
            onClick={handleBuyNow}
            style={{ backgroundColor: business.primaryColor }}
            className="flex-1 text-white"
          >
            Купить сейчас
          </Button>
        </div>
      </div>
    </div>
  );
}
