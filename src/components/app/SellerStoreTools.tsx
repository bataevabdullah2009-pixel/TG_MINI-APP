"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Copy, ExternalLink, Send, Share2, X } from "lucide-react";
import { buildBusinessShareLinks } from "@/lib/business-share-links";

export function SellerStoreTools({ businessSlug }: { businessSlug: string }) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const links = useMemo(() => buildBusinessShareLinks(businessSlug), [businessSlug]);
  const aiBotUrl = process.env.NEXT_PUBLIC_AI_CARD_BOT_URL || "";
  const preferredShareUrl = links.telegramMiniAppLink || links.webAppStoreUrl;

  const openUrl = (url: string) => {
    if (!url) return;
    const telegram = (window as any).Telegram?.WebApp;
    if (url.startsWith("https://t.me/") && telegram?.openTelegramLink) {
      telegram.openTelegramLink(url);
      return;
    }
    if (telegram?.openLink) {
      telegram.openLink(url);
      return;
    }
    window.location.assign(url);
  };

  const copyLink = async () => {
    if (!links.webAppStoreUrl) return;
    await navigator.clipboard.writeText(links.webAppStoreUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const shareInTelegram = () => {
    if (!preferredShareUrl) return;
    openUrl(
      `https://t.me/share/url?url=${encodeURIComponent(preferredShareUrl)}&text=${encodeURIComponent("Открыть витрину магазина")}`
    );
  };

  return (
    <>
      <div className="grid gap-3">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
              <Share2 size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-950">Поделиться витриной</h3>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-400">
                Отправьте клиенту прямую ссылку на магазин.
              </p>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                disabled={!businessSlug || !links.webAppStoreUrl}
                className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
              >
                Поделиться витриной
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Bot size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-950">Нужна красивая карточка товара?</h3>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-400">
                Создавайте карточки, посты и рекламные материалы в нашем AI-боте.
              </p>
              <button
                type="button"
                onClick={() => openUrl(aiBotUrl)}
                disabled={!aiBotUrl}
                className="mt-3 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {aiBotUrl ? "Открыть AI-бот" : "AI-бот не настроен"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55">
          <button className="absolute inset-0" aria-label="Закрыть" onClick={() => setShareOpen(false)} />
          <section className="relative w-full max-w-[480px] rounded-t-[32px] bg-white p-5 pb-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">Прямая ссылка на магазин</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">Ссылка открывает именно вашу витрину.</p>
              </div>
              <button type="button" onClick={() => setShareOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100">
                <X size={17} />
              </button>
            </div>

            <div className="break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
              {links.webAppStoreUrl || "NEXT_PUBLIC_WEBAPP_URL не настроен"}
            </div>

            <div className="mt-4 grid gap-2">
              <button type="button" onClick={copyLink} disabled={!links.webAppStoreUrl} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">
                <Copy size={15} /> {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
              </button>
              <button type="button" onClick={() => router.push(`/app/${encodeURIComponent(businessSlug)}`)} disabled={!businessSlug} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-800 disabled:opacity-40">
                <ExternalLink size={15} /> Открыть витрину
              </button>
              <button type="button" onClick={shareInTelegram} disabled={!preferredShareUrl} className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-xs font-black text-white disabled:opacity-40">
                <Send size={15} /> Поделиться в Telegram
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
