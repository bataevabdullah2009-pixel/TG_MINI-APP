"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, ShoppingBag } from "lucide-react";

export default function MiniAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const canShowTechnicalDetails = process.env.NODE_ENV !== "production";

  useEffect(() => {
    console.error("Mini App Error Caught:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-[30%] left-[10%] w-[250px] h-[250px] rounded-full bg-blue-600/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[30%] right-[10%] w-[250px] h-[250px] rounded-full bg-indigo-600/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm rounded-3xl border border-slate-900 bg-slate-900/30 backdrop-blur-xl p-6 text-center shadow-2xl relative z-10">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
          <AlertCircle size={24} />
        </div>

        <h1 className="text-lg font-black mb-1 tracking-tight">Ошибка загрузки витрины</h1>
        <p className="text-slate-400 text-xs mb-6 leading-relaxed">
          Не удалось запустить приложение. Пожалуйста, попробуйте перезапустить его или обновить экран.
        </p>

        <div className="grid gap-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition px-4 py-3 text-xs font-black"
          >
            <RefreshCw size={13} />
            Обновить витрину
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                // If inside Telegram, go back or close
                try {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg) tg.close();
                  else window.location.reload();
                } catch (e) {
                  window.location.reload();
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition px-4 py-3 text-xs font-black text-slate-300"
          >
            <ShoppingBag size={13} />
            Закрыть приложение
          </button>
        </div>

        {/* Technical Drawer */}
        {canShowTechnicalDetails && <div className="mt-5 border-t border-slate-900 pt-3 text-left">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-slate-650 hover:text-slate-550 text-[9px] font-bold font-mono transition-colors"
          >
            <span>ОТЛАДКА (DEBUG)</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showDetails && (
            <div className="mt-2 rounded-lg bg-slate-950/60 p-3 border border-slate-900 max-h-28 overflow-y-auto">
              <p className="text-red-400 font-mono text-[9px] break-all leading-relaxed whitespace-pre-wrap">
                Подробности ошибки записаны в server logs.
              </p>
              {error.digest && (
                <p className="text-slate-600 font-mono text-[8px] mt-1">
                  ID: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>}
      </div>
    </main>
  );
}
