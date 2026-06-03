"use client";

import React, { useState, useEffect } from "react";
import { X, Phone, Lock, CheckCircle, ShieldAlert } from "lucide-react";

interface PhoneVerificationScreenProps {
  businessId: string;
  telegramUserId: string;
  onVerified: (phone: string) => void;
  onClose?: () => void;
}

export function PhoneVerificationScreen({
  businessId,
  telegramUserId,
  onVerified,
  onClose,
}: PhoneVerificationScreenProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"SELECT" | "MANUAL_INPUT" | "OTP_INPUT">("SELECT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [verificationConfig, setVerificationConfig] = useState({
    canRequestCode: true,
    mockMode: true,
    testCodeEnabled: false,
    message: "",
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    fetch("/api/auth/phone/send-code")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok) {
          setVerificationConfig({
            canRequestCode: Boolean(data.canRequestCode),
            mockMode: Boolean(data.mockMode),
            testCodeEnabled: Boolean(data.testCodeEnabled),
            message: data.message || "",
          });
        }
      })
      .catch((e) => console.warn("[PhoneVerificationScreen] config load failed:", e));
  }, []);

  // Try to use Telegram Contact Share
  const handleTelegramContactShare = () => {
    setError(null);
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      setError("Telegram WebApp не доступен. Используйте ручной ввод.");
      setStep("MANUAL_INPUT");
      return;
    }

    try {
      tg.requestContact((shared: any) => {
        if (shared && shared.response) {
          // Success, we got contact
          verifyTelegramContact(shared.response);
        } else {
          // Fallback or user declined
          setError("Контакт не предоставлен. Введите телефон вручную.");
          setStep("MANUAL_INPUT");
        }
      });
    } catch (e) {
      console.error(e);
      setError("Ошибка запроса контакта. Введите телефон вручную.");
      setStep("MANUAL_INPUT");
    }
  };

  const verifyTelegramContact = async (contactPayload: any) => {
    if (!verificationConfig.canRequestCode) {
      setError(verificationConfig.message || "Подтвердите номер через Telegram contact в боте.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/phone/verify-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: contactPayload.phone_number || contactPayload.phone || "",
          initData: (window as any).Telegram?.WebApp?.initData || "",
          businessId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось сохранить контакт");
      }

      onVerified(data.phone || contactPayload.phone_number || contactPayload.phone);
    } catch (e: any) {
      setError(e.message || "Ошибка верификации контакта");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError("Введите корректный номер телефона");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          initData: (window as any).Telegram?.WebApp?.initData || "",
          businessId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось отправить код");
      }

      if (data.message) {
        setVerificationConfig((current) => ({ ...current, message: data.message }));
      }

      setStep("OTP_INPUT");
      setTimer(60);
    } catch (e: any) {
      setError(e.message || "Ошибка отправки SMS");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 4) {
      setError("Введите 4-значный код");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          initData: (window as any).Telegram?.WebApp?.initData || "",
          businessId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Неверный код верификации");
      }

      onVerified(data.phone || phone);
    } catch (e: any) {
      setError(e.message || "Ошибка верификации кода");
    } finally {
      setLoading(false);
    }
  };

  const handleBypassDev = () => {
    // Direct verification for fast dev testing
    onVerified(phone || "+79998887766");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-t-[32px] bg-white px-6 pb-8 pt-5 shadow-2xl ring-1 ring-black/5 sm:rounded-[32px] animate-slide-up">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-blue-600">
              <Lock size={16} />
            </span>
            <h2 className="text-lg font-black tracking-tight text-slate-900">Безопасность</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-extrabold text-slate-900">Подтвердите номер</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Для оформления заказов и бронирования услуг требуется быстрая верификация телефона.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/60">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* State 1: Choose Method */}
        {step === "SELECT" && (
          <div className="space-y-3">
            <button
              onClick={handleTelegramContactShare}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
            >
              <Phone size={18} fill="white" />
              Поделиться через Telegram
            </button>

            {verificationConfig.canRequestCode ? (
              <button
                onClick={() => setStep("MANUAL_INPUT")}
                className="w-full rounded-2xl bg-slate-100 py-3.5 text-sm font-bold text-slate-800 active:scale-95 transition-all"
              >
                Ввести номер вручную
              </button>
            ) : (
              <div className="rounded-2xl bg-slate-100 p-3.5 text-center text-xs font-bold text-slate-600">
                {verificationConfig.message || "Подтвердите номер через Telegram contact в боте"}
              </div>
            )}
          </div>
        )}

        {/* State 2: Manual Input */}
        {step === "MANUAL_INPUT" && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Номер телефона
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  📱
                </span>
                <input
                  type="tel"
                  required
                  placeholder="+7 (999) 123-45-67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Отправка кода..." : verificationConfig.mockMode ? "Получить тестовый код" : "Получить код"}
            </button>

            <button
              type="button"
              onClick={() => setStep("SELECT")}
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition"
            >
              ← Вернуться к выбору
            </button>
          </form>
        )}

        {/* State 3: OTP Input */}
        {step === "OTP_INPUT" && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="text-center mb-2">
              <span className="text-xs font-bold text-slate-500">
                {verificationConfig.testCodeEnabled ? "Тестовый режим: код 1111 для номера " : "Код отправлен на номер "}
                <strong className="text-slate-800">{phone}</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                Код подтверждения
              </label>
              <input
                type="text"
                required
                maxLength={4}
                placeholder="0 0 0 0"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-center tracking-[0.6em] rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-lg font-black text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              {verificationConfig.testCodeEnabled && (
                <p className="mt-1.5 text-center text-[11px] font-medium text-blue-600">
                  Тестовый режим: введите <span className="font-extrabold">1111</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/25 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Проверка..." : "Подтвердить код"}
            </button>

            <div className="flex justify-between items-center text-xs font-bold px-1">
              <button
                type="button"
                onClick={() => setStep("MANUAL_INPUT")}
                className="text-slate-400 hover:text-slate-600"
              >
                Изменить номер
              </button>
              {timer > 0 ? (
                <span className="text-slate-400">Повторить через {timer}с</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Отправить повторно
                </button>
              )}
            </div>
          </form>
        )}

        {/* Dev Mode quick bypass */}
        {(process.env.NODE_ENV !== "production" || ALLOW_DEV_BYPASS) && (
          <div className="mt-6 border-t border-dashed border-slate-200 pt-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 block mb-2">
              🛠️ Режим разработчика
            </span>
            <button
              onClick={handleBypassDev}
              className="rounded-full bg-amber-50 px-4 py-1.5 text-[11px] font-extrabold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition"
            >
              Мгновенный обход (Bypass)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ALLOW_DEV_BYPASS = process.env.NODE_ENV !== "production";
