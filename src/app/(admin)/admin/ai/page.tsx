"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Save, Sparkles, Wand2 } from "lucide-react";
import { AccessDeniedScreen } from "@/components/app/AccessDeniedScreen";

const features = [
  ["post", "Telegram-пост"],
  ["product_card", "Карточка товара"],
  ["improve", "Улучшить текст"],
] as const;

const tones = ["спокойный", "продающий", "премиум", "дружелюбный"];
const moderationActions = [
  ["improve", "Сделать понятнее"],
  ["selling", "Сделать продающим"],
  ["shorten", "Сократить"],
  ["telegram", "Подготовить для Telegram"],
  ["story", "Подготовить для сторис"],
] as const;

type Draft = { id: string; title: string; content: string; type: string; status: string; createdAt: string };

export default function AdminAIPage() {
  const router = useRouter();
  const [isManager, setIsManager] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [feature, setFeature] = useState("post");
  const [tone, setTone] = useState("дружелюбный");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userJson = localStorage.getItem("adminUser");
    if (!userJson) {
      router.push("/admin/login");
      return;
    }
    const u = JSON.parse(userJson);
    if (u.role === "MANAGER") {
      setIsManager(true);
      setLoading(false);
      return;
    }
    loadMeta();
  }, [router]);

  async function loadMeta() {
    const res = await fetch("/api/admin/ai");
    const data = await res.json();
    if (data.ok) {
      setMeta(data);
      setProvider(data.provider);
      setModel(data.model);
      loadDrafts(data.businessId);
    } else {
      setError(data.error || "Не удалось загрузить ИИ-маркетинг.");
    }
  }

  async function loadDrafts(businessId = meta?.businessId) {
    if (!businessId) return;
    const res = await fetch(`/api/admin/ai/drafts?businessId=${businessId}`);
    const data = await res.json();
    if (data.ok) setDrafts(data.data || []);
  }

  async function generate() {
    setLoading(true);
    setError("");
    setWarnings([]);
    try {
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: meta?.businessId, feature, tone, prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Не удалось сгенерировать текст.");
      setResult(
        data.content ||
          JSON.stringify(
            {
              title: data.title || data.name || "",
              description: data.description || "",
              category: data.category || "",
              marketingText: data.marketingText || "",
              imagePrompt: data.imagePrompt || "",
            },
            null,
            2
          )
      );
      setProvider(data.provider || provider);
      setModel(data.model || model);
      loadMeta();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function moderate(action = "improve") {
    setError("");
    const res = await fetch("/api/admin/ai/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt || result, action }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Не удалось проверить текст.");
      return;
    }
    setResult(data.improved || "");
    setWarnings(data.warnings || []);
  }

  async function saveDraft(status = "draft") {
    if (!result) return;
    const res = await fetch("/api/admin/ai/save-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: meta?.businessId,
        type: feature,
        status,
        title: features.find(([key]) => key === feature)?.[1] || "Черновик",
        content: result,
        provider,
        model,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Не удалось сохранить черновик.");
      return;
    }
    setNotice(status === "approved" ? "Черновик одобрен" : "Черновик сохранён");
    setTimeout(() => setNotice(""), 2500);
    loadDrafts();
  }

  if (isManager) {
    return (
      <AccessDeniedScreen 
        backUrl="/admin" 
        backText="Вернуться в панель" 
        description="Менеджеры не имеют доступа к ИИ-маркетингу." 
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-slate-500">Назад в панель</Link>
            <h1 className="text-2xl font-black">ИИ-маркетинг</h1>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
            {meta?.dailyUsage ?? 0}/{meta?.dailyLimit ?? 0} запросов сегодня · {meta?.plan || "FREE"}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_1fr_340px]">
        <aside className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-black">Инструменты</h2>
          <div className="space-y-2">
            {features.map(([key, label]) => (
              <button key={key} onClick={() => setFeature(key)} className={`w-full rounded-xl px-3 py-3 text-left text-sm font-bold ${feature === key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
          {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">{features.find(([key]) => key === feature)?.[1]}</h2>
                <p className="text-sm text-slate-500">{meta?.businessName} · провайдер: {meta?.provider}</p>
              </div>
              <Sparkles className="text-blue-600" />
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {tones.map((entry) => (
                <button key={entry} onClick={() => setTone(entry)} className={`rounded-xl px-3 py-2 text-xs font-black ${tone === entry ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{entry}</button>
              ))}
            </div>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Опишите задачу, товар, услугу, акцию или вставьте текст для улучшения." className="h-40 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={generate} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                <Wand2 size={17} />
                {loading ? "Генерация..." : "Сгенерировать"}
              </button>
              {moderationActions.map(([key, label]) => <button key={key} onClick={() => moderate(key)} className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">{label}</button>)}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Результат</h2>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(result)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><Copy size={17} /></button>
                <button onClick={() => saveDraft("draft")} disabled={!result} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 disabled:opacity-40"><Save size={17} /></button>
                <button onClick={() => saveDraft("approved")} disabled={!result} className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 disabled:opacity-40"><Check size={17} /></button>
              </div>
            </div>
            <textarea value={result} onChange={(e) => setResult(e.target.value)} placeholder="Здесь появится готовый текст." className="min-h-64 w-full resize-y rounded-2xl bg-slate-50 p-4 text-sm leading-6 outline-none" />
            {warnings.length > 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
          </div>
        </div>

        <aside className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-black">История черновиков</h2>
          <div className="space-y-3">
            {drafts.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Черновиков пока нет.</p>}
            {drafts.map((draft) => (
              <button key={draft.id} onClick={() => setResult(draft.content)} className="w-full rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black">{draft.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{draft.status === "approved" ? "одобрен" : "черновик"}</span>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-slate-500">{draft.content}</p>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
