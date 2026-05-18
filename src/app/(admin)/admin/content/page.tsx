"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

const CONTENT_TYPES = [
  { id: "telegram_post", name: "📱 Пост для Telegram", icon: "📝" },
  { id: "instagram_post", name: "📸 Пост для Instagram", icon: "🎨" },
  { id: "promo", name: "🎁 Акция недели", icon: "🔥" },
  { id: "product_desc", name: "🛍️ Описание товара", icon: "✨" },
  { id: "review_reply", name: "⭐ Ответ на отзыв", icon: "💬" },
];

const TONES = ["Продающий", "Спокойный", "Дружелюбный", "Премиум", "Дерзкий", "С юмором"];

export default function AdminContentPage() {
  const [selectedType, setSelectedType] = useState(CONTENT_TYPES[0].id);
  const [tone, setTone] = useState(TONES[0]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const generateContent = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult("");
    
    try {
      const typeName = CONTENT_TYPES.find(t => t.id === selectedType)?.name || "Текст";
      const fullPrompt = `Тема/Запрос: ${prompt}. Тон: ${tone}.`;
      
      const res = await apiClient.post("/ai/generate-content", {
        prompt: fullPrompt,
        type: typeName,
      });
      
      setResult(res.data.content || "Не удалось сгенерировать текст.");
    } catch (e) {
      console.error(e);
      setResult("Произошла ошибка при обращении к ИИ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - simplified for this page context */}
      <aside className="w-64 bg-gray-900 text-white hidden md:flex flex-col">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold">🤖 LocalAI</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/admin" className="block px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-sm">Dashboard</Link>
          <Link href="/admin/content" className="block px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-medium">Генератор контента</Link>
          <Link href="/admin/ai" className="block px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-sm">Настройки ИИ</Link>
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">✍️ ИИ Генератор контента</h1>
            <p className="text-muted-foreground mt-1">Создавайте посты, акции и описания товаров за пару секунд</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 space-y-6">
              <Card>
                <CardContent className="p-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Что создаем?</label>
                      <div className="grid grid-cols-1 gap-2">
                        {CONTENT_TYPES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedType(t.id)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-all ${
                              selectedType === t.id ? "bg-blue-50 border-blue-200 text-blue-700 font-medium" : "bg-white hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <span>{t.icon}</span> {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Тон общения</label>
                      <select 
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full border-gray-300 rounded-md border p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">О чем написать?</label>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Например: Новое меню завтраков, скидка 20% до конца недели..."
                        className="w-full border-gray-300 rounded-md border p-3 h-24 text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <Button 
                      onClick={generateContent} 
                      disabled={loading || !prompt}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {loading ? "✨ Магия ИИ работает..." : "🚀 Сгенерировать"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-7">
              <Card className="h-full min-h-[500px] flex flex-col">
                <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Результат</h3>
                  {result && (
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(result)}>
                      📋 Копировать
                    </Button>
                  )}
                </div>
                <CardContent className="p-6 flex-1 bg-white">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                      <div className="animate-spin text-4xl">🪄</div>
                      <p className="text-sm">Генерируем лучший вариант...</p>
                    </div>
                  ) : result ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {result}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                      <div className="text-6xl mb-4">📝</div>
                      <p>Здесь появится сгенерированный текст</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
