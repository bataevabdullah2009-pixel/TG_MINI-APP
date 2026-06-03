"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Business, Item, Staff } from "@/types";
import { apiClient } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";
import { BottomNavigation } from "@/components/mini-app/BottomNavigation";
import { useTelegram } from "@/hooks/useTelegram";
import Link from "next/link";

const BookingSchema = z.object({
  serviceId: z.string().min(1, "Выберите услугу"),
  staffId: z.string().optional(),
  customerName: z.string().min(2, "Введите имя"),
  customerPhone: z.string().min(10, "Введите телефон"),
  date: z.string().min(1, "Выберите дату"),
  time: z.string().min(1, "Выберите время"),
  comment: z.string().optional(),
});

type BookingInput = z.infer<typeof BookingSchema>;

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00",
];

function getNext14Days() {
  const days = [];
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      value: d.toISOString().split("T")[0],
      dayName: dayNames[d.getDay()],
      day: d.getDate(),
      month: monthNames[d.getMonth()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return days;
}

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const tg = useTelegram();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const days = getNext14Days();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(BookingSchema),
  });

  const selectedServiceId = watch("serviceId");
  const selectedStaffId = watch("staffId");
  const selectedDate = watch("date");
  const selectedTime = watch("time");

  const selectedService = services.find((s) => s.id === selectedServiceId);

  useEffect(() => {
    async function fetchData() {
      try {
        const [businessRes, itemsRes] = await Promise.all([
          apiClient.get(`/businesses/${slug}`),
          apiClient.get(`/items/${slug}`),
        ]);
        setBusiness(businessRes.data);
        const allItems = Array.isArray(itemsRes.data)
          ? itemsRes.data
          : itemsRes.data?.data || [];
        setServices(allItems.filter((i: Item) => i.type === "SERVICE"));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  // Prefill from Telegram
  useEffect(() => {
    if (tg?.initDataUnsafe?.user) {
      const user = tg.initDataUnsafe.user;
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      if (name) setValue("customerName", name);
    }
  }, [tg, setValue]);

  const onSubmit = async (data: BookingInput) => {
    if (!business) return;
    setSubmitting(true);
    setError(null);

    try {
      const startDateTime = new Date(`${data.date}T${data.time}:00`);
      const duration = selectedService?.durationMinutes || 60;
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      await apiClient.post("/bookings", {
        businessId: business.id,
        serviceId: data.serviceId,
        staffId: data.staffId || undefined,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        comment: data.comment,
      });

      if (tg) {
        tg.showAlert(`✅ Запись оформлена!\n${data.date} в ${data.time}`);
      }

      router.push(`/${slug}/profile`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Ошибка при записи");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm ring-1 ring-slate-100 max-w-sm w-full">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-lg font-black mb-1 text-slate-900">Бизнес не найден</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Указанный бизнес не зарегистрирован на платформе Vitrina AI. Проверьте правильность адреса.
          </p>
          <Link href="/app">
            <Button className="w-full font-black py-4 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition">
              В каталог Vitrina AI
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pb-24">
        <div className="text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-xl font-bold mb-2">Записей нет</h2>
          <p className="text-muted-foreground mb-6">Нет доступных услуг для записи</p>
          <Link href={`/${slug}`}>
            <Button variant="outline">На главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  const primaryColor = business.primaryColor;

  return (
    <div className="pb-28">
      {/* Header */}
      <div
        className="p-4 text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${business.accentColor})` }}
      >
        <button onClick={() => router.back()} className="text-white/80 text-sm mb-2 block">
          ← Назад
        </button>
        <h1 className="text-xl font-bold">📅 Онлайн-запись</h1>
        <p className="text-white/80 text-sm mt-1">{business.name}</p>
      </div>

      {/* Steps */}
      <div className="flex border-b bg-white sticky top-0 z-10">
        {[
          { n: 1 as const, label: "Услуга" },
          { n: 2 as const, label: "Дата & Время" },
          { n: 3 as const, label: "Контакты" },
        ].map((s) => (
          <button
            key={s.n}
            onClick={() => {
              if (s.n < step || (s.n === 2 && selectedServiceId) || s.n === step) {
                setStep(s.n);
              }
            }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              step === s.n
                ? "border-current"
                : "border-transparent text-muted-foreground"
            }`}
            style={{ color: step === s.n ? primaryColor : undefined,
                     borderColor: step === s.n ? primaryColor : undefined }}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {/* Step 1: Service Selection */}
        {step === 1 && (
          <div>
            <h2 className="font-bold mb-3">Выберите услугу</h2>
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setValue("serviceId", service.id);
                    setStep(2);
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedServiceId === service.id
                      ? "border-current"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{
                    borderColor: selectedServiceId === service.id ? primaryColor : undefined,
                    backgroundColor:
                      selectedServiceId === service.id
                        ? `${primaryColor}10`
                        : undefined,
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      {service.durationMinutes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ⏱️ {service.durationMinutes} мин
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="font-bold" style={{ color: primaryColor }}>
                        {formatPrice(service.price)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {errors.serviceId && (
              <p className="text-red-500 text-sm mt-2">{errors.serviceId.message}</p>
            )}
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Selected Service Summary */}
            {selectedService && (
              <div
                className="p-3 rounded-xl text-white text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                <p className="font-semibold">{selectedService.name}</p>
                <p className="opacity-80">
                  {formatPrice(selectedService.price)}
                  {selectedService.durationMinutes && ` · ${selectedService.durationMinutes} мин`}
                </p>
              </div>
            )}

            {/* Date Picker */}
            <div>
              <h2 className="font-bold mb-3">📅 Выберите дату</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {days.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setValue("date", day.value)}
                    className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl border-2 min-w-[60px] transition-all ${
                      selectedDate === day.value
                        ? "text-white border-transparent"
                        : day.isWeekend
                        ? "bg-red-50 border-red-100 text-red-600"
                        : "bg-gray-50 border-gray-200 hover:border-gray-300"
                    }`}
                    style={
                      selectedDate === day.value
                        ? { backgroundColor: primaryColor, borderColor: primaryColor }
                        : {}
                    }
                  >
                    <span className="text-xs font-medium">{day.dayName}</span>
                    <span className="text-xl font-bold leading-tight">{day.day}</span>
                    <span className="text-xs">{day.month}</span>
                  </button>
                ))}
              </div>
              {errors.date && (
                <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>
              )}
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div>
                <h2 className="font-bold mb-3">⏰ Выберите время</h2>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setValue("time", time)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                        selectedTime === time
                          ? "text-white border-transparent"
                          : "bg-gray-50 border-gray-200 hover:border-gray-300"
                      }`}
                      style={
                        selectedTime === time
                          ? { backgroundColor: primaryColor, borderColor: primaryColor }
                          : {}
                      }
                    >
                      {time}
                    </button>
                  ))}
                </div>
                {errors.time && (
                  <p className="text-red-500 text-sm mt-1">{errors.time.message}</p>
                )}
              </div>
            )}

            <Button
              type="button"
              className="w-full text-white py-5"
              style={{ backgroundColor: primaryColor }}
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep(3)}
            >
              Далее →
            </Button>
          </div>
        )}

        {/* Step 3: Contact */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Booking Summary */}
            {selectedService && selectedDate && selectedTime && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h2 className="font-bold mb-2">📋 Ваша запись</h2>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Услуга</span>
                    <span className="font-medium">{selectedService.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Дата</span>
                    <span className="font-medium">
                      {new Date(selectedDate).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Время</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                    <span>Стоимость</span>
                    <span style={{ color: primaryColor }}>
                      {formatPrice(selectedService.price)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h2 className="font-bold mb-3">👤 Ваши данные</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Имя *</label>
                  <Input
                    {...register("customerName")}
                    placeholder="Иван Иванов"
                    className={errors.customerName ? "border-red-500" : ""}
                  />
                  {errors.customerName && (
                    <p className="text-red-500 text-xs mt-1">{errors.customerName.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Телефон *</label>
                  <Input
                    {...register("customerPhone")}
                    type="tel"
                    placeholder="+7 (999) 000-00-00"
                    className={errors.customerPhone ? "border-red-500" : ""}
                  />
                  {errors.customerPhone && (
                    <p className="text-red-500 text-xs mt-1">{errors.customerPhone.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Комментарий</label>
                  <textarea
                    {...register("comment")}
                    placeholder="Пожелания к записи..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 text-sm">⚠️ {error}</p>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Bottom Actions */}
      {step === 3 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto">
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={submitting}
            className="w-full py-6 text-base font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? "⏳ Записываем..." : "✅ Подтвердить запись"}
          </Button>
        </div>
      )}

      <BottomNavigation businessSlug={slug} primaryColor={primaryColor} />
    </div>
  );
}
