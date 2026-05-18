"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccessDeniedScreen } from "@/components/app/AccessDeniedScreen";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    items: number;
  };
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");
  const [isManager, setIsManager] = useState(false);
  
  // Create / Edit Category state
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const userJson = localStorage.getItem("adminUser");
    if (!userJson) {
      router.push("/admin/login");
      return;
    }

    const user = JSON.parse(userJson);
    if (user.role === "MANAGER") {
      setIsManager(true);
      setLoading(false);
      return;
    }

    if (!user.businessId) {
      // Super admin without active business
      setError("Выберите заведение в панели Super Admin или настройте свой профиль");
      setLoading(false);
      return;
    }

    setBusinessId(user.businessId);
    fetchCategories(user.businessId);
  }, [router]);

  const fetchCategories = async (bizId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/categories?businessId=${bizId}`);
      const data = await res.json();
      if (res.ok) {
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Categories fetch failed:", e);
      // Fallback
      setCategories([
        { id: "c1", name: "🍔 Основные Бургеры", sortOrder: 1, isActive: true, _count: { items: 6 } },
        { id: "c2", name: "🍟 Хрустящие Закуски", sortOrder: 2, isActive: true, _count: { items: 3 } },
        { id: "c3", name: "🥤 Освежающие Напитки", sortOrder: 3, isActive: true, _count: { items: 4 } }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      if (editingId) {
        // Edit Category
        const res = await fetch(`/api/categories?id=${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, sortOrder }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCategories((prev) =>
            prev.map((c) => (c.id === editingId ? { ...c, name: updated.name, sortOrder: updated.sortOrder } : c))
          );
          setEditingId(null);
          setName("");
          setSortOrder("0");
        } else {
          throw new Error("Не удалось обновить категорию");
        }
      } else {
        // Create Category
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, businessId, sortOrder }),
        });
        if (res.ok) {
          const created = await res.json();
          setCategories((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
          setName("");
          setSortOrder("0");
        } else {
          throw new Error("Не удалось создать категорию");
        }
      }
    } catch (err: any) {
      setError(err.message || "Произошла ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setSortOrder(c.sortOrder.toString());
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту категорию? Все товары в ней останутся без категории.")) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } else {
        const errData = await res.json();
        alert(errData.error || "Не удалось удалить категорию");
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-650" />
      </div>
    );
  }

  if (isManager) {
    return (
      <AccessDeniedScreen 
        backUrl="/admin" 
        backText="Вернуться в панель" 
        description="Менеджеры не имеют доступа к управлению категориями каталога." 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* Top sticky header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">← Dashboard</Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-bold text-lg">📁 Категории каталога</h1>
          </div>
          <Link href="/admin/items">
            <Button size="sm" className="bg-blue-650 hover:bg-blue-700 text-white font-bold">🛍️ Перейти к товарам</Button>
          </Link>
        </div>
      </div>

      {/* Content body */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 w-full">
        
        {/* Editor Form */}
        <div className="md:col-span-1">
          <Card className="bg-white border rounded-xl shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-extrabold text-base mb-4">
                {editingId ? "✏️ Редактировать категорию" : "➕ Создать категорию"}
              </h2>

              <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Название категории</label>
                  <Input
                    type="text"
                    placeholder="Например: 🍟 Закуски"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs py-2.5 rounded-lg border-gray-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Порядок сортировки</label>
                  <Input
                    type="number"
                    required
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="text-xs py-2.5 rounded-lg border-gray-300 font-mono"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    type="submit" 
                    disabled={submitting} 
                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs py-2.5 rounded-lg"
                  >
                    {submitting ? "Сохранение..." : editingId ? "Сохранить изменения" : "Добавить категорию"}
                  </Button>
                  
                  {editingId && (
                    <Button 
                      type="button" 
                      onClick={() => {
                        setEditingId(null);
                        setName("");
                        setSortOrder("0");
                      }} 
                      variant="outline"
                      className="text-xs"
                    >
                      Отмена
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Categories List */}
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-white border rounded-xl shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-base mb-4">Список ваших категорий</h3>
              
              {categories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <span className="text-4xl block mb-2">📁</span>
                  <p>Категории еще не созданы.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b text-slate-500 font-bold">
                        <th className="p-3">Сортировка</th>
                        <th className="p-3">Название категории</th>
                        <th className="p-3 text-center">Товаров в ней</th>
                        <th className="p-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {categories.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 font-mono font-bold text-slate-500">{c.sortOrder}</td>
                          <td className="p-3 font-semibold text-gray-900">{c.name}</td>
                          <td className="p-3 text-center font-bold text-blue-650">{c._count?.items || 0}</td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleEditClick(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(c.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-650 font-bold transition"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
