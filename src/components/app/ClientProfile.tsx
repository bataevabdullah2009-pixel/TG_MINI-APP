"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, ShieldAlert, Phone, Shield } from "lucide-react";
import { PhoneVerificationScreen } from "./PhoneVerificationScreen";

interface ClientProfileProps {
  session: any;
  onRefreshSession: () => void | Promise<void>;
  onSwitchMode?: (mode: "CUSTOMER" | "SELLER" | "MANAGER" | "SUPER_ADMIN") => void;
}

export function ClientProfile({ session, onRefreshSession, onSwitchMode }: ClientProfileProps) {
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pollingUntil, setPollingUntil] = useState<number | null>(null);

  const customer = session?.customer || {};
  const isVerified = customer.phoneVerified === true;

  useEffect(() => {
    if (!pollingUntil || isVerified) return undefined;

    const interval = window.setInterval(() => {
      if (Date.now() > pollingUntil) {
        setPollingUntil(null);
        window.clearInterval(interval);
        return;
      }
      onRefreshSession();
    }, 2500);

    return () => window.clearInterval(interval);
  }, [pollingUntil, isVerified, onRefreshSession]);

  if (!session) {
    return (
      <div className="px-4 py-5 text-slate-900 pb-24">
        <div className="rounded-3xl bg-white p-5 text-center ring-1 ring-slate-100">
          <h1 className="text-lg font-black text-slate-900">Профиль временно недоступен</h1>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Каталог доступен. Обновите профиль после применения SQL-патча к базе.
          </p>
          <button
            onClick={() => onRefreshSession()}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-indigo-600 transition active:scale-95"
          >
            <RefreshCw size={14} />
            Обновить профиль
          </button>
        </div>
      </div>
    );
  }

  const startVerificationFlow = () => {
    setShowVerifyModal(true);
    setPollingUntil(Date.now() + 20_000);
  };

  const handleVerified = async (_phone: string) => {
    setShowVerifyModal(false);
    setPollingUntil(null);
    await onRefreshSession();
  };

  return (
    <div className="px-4 py-5 text-slate-900 pb-24">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Профиль</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Ваш аккаунт в SmartBiz AI</p>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/10 mb-5 relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] text-white/5 font-black text-9xl select-none pointer-events-none">
          TG
        </div>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white text-xl font-bold border border-white/10">
            {customer.name ? customer.name[0] : "👤"}
          </div>
          <div>
            <h3 className="text-base font-extrabold">{customer.name || "Покупатель"}</h3>
            {customer.username && <p className="text-xs text-white/50">@{customer.username}</p>}
            <p className="text-[10px] font-bold text-white/40 mt-1">ID: {session.telegramUserId}</p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Верификация телефона</h4>

        {isVerified ? (
          <div className="flex items-center gap-3.5 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200/50">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/10">
              <ShieldCheck size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-black text-emerald-800">Статус: подтвержден</h5>
              <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                Номер {customer.phone || "телефона"} полностью верифицирован.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200/50">
            <div className="flex items-center gap-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/10">
                <ShieldAlert size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-black text-amber-800">Статус: не подтвержден</h5>
                <p className="text-[11px] font-semibold text-amber-600 mt-0.5">
                  Подтвердите телефон, чтобы делать покупки и записи.
                </p>
              </div>
            </div>

            <button
              onClick={startVerificationFlow}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-600 py-3 text-xs font-black text-white hover:bg-slate-900 transition active:scale-95 shadow-md shadow-amber-600/10"
            >
              <Phone size={14} fill="white" />
              Подтвердить сейчас
            </button>
            <button
              onClick={() => onRefreshSession()}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-xs font-black text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition active:scale-95"
            >
              <RefreshCw size={14} />
              Проверить статус
            </button>
          </div>
        )}
      </div>

      {onSwitchMode && (session?.role === "BUSINESS_OWNER" || session?.role === "SUPER_ADMIN" || session?.role === "MANAGER") && (
        <div className="mb-5 rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400">Панель управления</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Вам доступны инструменты управления заведениями</p>
            </div>
          </div>

          <div className="grid gap-2 text-xs font-bold text-slate-900 pt-1">
            {session.role === "BUSINESS_OWNER" && (
              <button
                onClick={() => onSwitchMode("SELLER")}
                className="w-full rounded-2xl bg-white hover:bg-slate-100 py-3 text-center transition active:scale-95 shadow-sm"
              >
                💼 Управление бизнесом
              </button>
            )}

            {session.role === "MANAGER" && (
              <button
                onClick={() => onSwitchMode("MANAGER")}
                className="w-full rounded-2xl bg-white hover:bg-slate-100 py-3 text-center transition active:scale-95 shadow-sm"
              >
                📋 Рабочая панель менеджера
              </button>
            )}

            {session.role === "SUPER_ADMIN" && (
              <>
                <button
                  onClick={() => onSwitchMode("SELLER")}
                  className="w-full rounded-2xl bg-white hover:bg-slate-100 py-3 text-center transition active:scale-95 shadow-sm"
                >
                  💼 Управление бизнесом
                </button>
                <button
                  onClick={() => onSwitchMode("SUPER_ADMIN")}
                  className="w-full rounded-2xl bg-amber-400 hover:bg-amber-300 py-3 text-center transition active:scale-95 shadow-sm"
                >
                  👑 SaaS панель администратора
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white p-4.5 ring-1 ring-slate-100/90 text-xs text-slate-500 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Shield size={14} className="text-indigo-600" />
          <span>Конфиденциальность и безопасность</span>
        </div>
        <p className="leading-relaxed font-medium">
          Мы надежно храним данные о ваших заказах и бронированиях. Контакты передаются только заведениям, где вы оформляете заказ.
        </p>
      </div>

      {showVerifyModal && (
        <PhoneVerificationScreen
          businessId={customer.businessId || "global"}
          telegramUserId={session.telegramUserId.toString()}
          onVerified={handleVerified}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </div>
  );
}
