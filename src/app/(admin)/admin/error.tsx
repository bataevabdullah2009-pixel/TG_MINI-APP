"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, LayoutDashboard } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("Admin Panel Error Caught:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900 font-sans">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5 text-red-600">
          <AlertCircle size={28} />
        </div>

        <h1 className="text-xl font-black mb-1.5 tracking-tight text-slate-950">Ошибка панели управления</h1>
        <p className="text-slate-500 text-xs mb-6 leading-relaxed">
          Произошел технический сбой при загрузке разделов админ-панели. Вы можете обновить текущую страницу или вернуться к началу.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.98] transition px-4 py-3 text-xs font-black text-white"
          >
            <RefreshCw size={13} />
            Обновить страницу
          </button>
          <Link
            href="/admin"
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition px-4 py-3 text-xs font-black text-slate-700"
          >
            <LayoutDashboard size={13} />
            Вернуться в панель
          </Link>
        </div>

        {/* Technical Info */}
        <div className="mt-6 border-t border-slate-100 pt-4 text-left">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-slate-400 hover:text-slate-500 text-[10px] font-bold font-mono transition-colors"
          >
            <span>ОТЛАДОЧНАЯ ИНФОРМАЦИЯ</span>
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showDetails && (
            <div className="mt-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-150 max-h-40 overflow-y-auto">
              <p className="text-red-700 font-mono text-[9px] break-all leading-relaxed whitespace-pre-wrap">
                Подробности ошибки записаны в server logs.
              </p>
              {error.digest && (
                <p className="text-slate-400 font-mono text-[8px] mt-1.5">
                  Digest ID: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
