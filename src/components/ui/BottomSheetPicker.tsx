"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

export type BottomSheetPickerOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type BottomSheetPickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: BottomSheetPickerOption[];
  title: string;
  placeholder?: string;
  buttonClassName?: string;
};

export function BottomSheetPicker({
  value,
  onChange,
  options,
  title,
  placeholder = "Выберите вариант",
  buttonClassName = "",
}: BottomSheetPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 text-left ${buttonClassName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{selected?.label || placeholder}</span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-[10px] font-bold opacity-60">{selected.description}</span>
          )}
        </span>
        <ChevronDown size={17} className="shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative max-h-[82dvh] w-full max-w-lg animate-in slide-in-from-bottom-5 overflow-hidden rounded-t-3xl bg-white shadow-2xl duration-200 sm:rounded-3xl"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-black text-slate-950">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </header>
            <div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-40 ${
                      isSelected
                        ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                        : "border-slate-100 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {option.icon && (
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isSelected ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                        {option.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black">{option.label}</span>
                      {option.description && <span className="mt-0.5 block text-xs font-bold text-slate-400">{option.description}</span>}
                    </span>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-transparent"}`}>
                      <Check size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
