"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
        {/* Decorative Glow */}
        <div className="absolute top-[20%] left-[20%] w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[20%] w-[350px] h-[350px] rounded-full bg-cyan-600/10 blur-[100px] pointer-events-none" />

        <div className="max-w-md w-full rounded-3xl border border-slate-900 bg-slate-900/40 backdrop-blur-xl p-8 text-center shadow-2xl relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6 text-amber-500">
            <AlertTriangle size={32} />
          </div>

          <h1 className="text-2xl font-black mb-2 tracking-tight">Что-то пошло не так</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Произошла непредвиденная ошибка на сервере или приложении. Мы уже в курсе проблемы и работаем над её исправлением.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition px-5 py-3.5 text-xs font-black"
            >
              <RefreshCw size={14} />
              Попробовать снова
            </button>
            <a
              href="/"
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition px-5 py-3.5 text-xs font-black text-slate-300"
            >
              <Home size={14} />
              На главную
            </a>
          </div>

          {/* Technical Info Drawer */}
          <div className="mt-8 border-t border-slate-900/60 pt-4 text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-slate-500 hover:text-slate-400 text-xs font-bold font-mono transition-colors"
            >
              <span>ТЕХНИЧЕСКИЕ ДЕТАЛИ</span>
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDetails && (
              <div className="mt-3 rounded-xl bg-slate-950 p-4 border border-slate-900 max-h-40 overflow-y-auto">
                <p className="text-red-400 font-mono text-[10px] break-all leading-relaxed whitespace-pre-wrap">
                  {error.message || "Unknown error"}
                </p>
                {error.digest && (
                  <p className="text-slate-600 font-mono text-[9px] mt-2">
                    ID: {error.digest}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
