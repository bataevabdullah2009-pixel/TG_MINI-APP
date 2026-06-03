"use client";

import React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface AccessDeniedScreenProps {
  title?: string;
  description?: string;
  backUrl?: string;
  backText?: string;
}

export function AccessDeniedScreen({
  title = "Доступ ограничен",
  description = "У вашего аккаунта нет прав для просмотра этого раздела. Если вы считаете, что это ошибка, обратитесь к администратору.",
  backUrl = "/app",
  backText = "Вернуться на главную",
}: AccessDeniedScreenProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 select-none relative overflow-hidden font-sans">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-25 pointer-events-none" />

      <div className="my-auto max-w-sm mx-auto text-center space-y-6 relative z-10">
        <div className="relative inline-block">
          <div className="absolute inset-0 rounded-full bg-rose-600/20 blur-xl animate-pulse" />
          <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-rose-600/20 text-rose-500 border border-rose-500/30 mx-auto text-5xl shadow-2xl">
            <ShieldAlert className="h-10 w-10 animate-bounce" />
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            {description}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href={backUrl}
            className="inline-flex items-center justify-center gap-2 w-full rounded-2xl bg-slate-800 hover:bg-slate-750 text-xs font-black text-white hover:text-white border border-slate-700/60 py-4 px-6 active:scale-98 transition shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            {backText}
          </Link>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-600 font-bold tracking-widest uppercase mt-4 relative z-10">
        Vitrina AI Security Shield
      </p>
    </div>
  );
}
