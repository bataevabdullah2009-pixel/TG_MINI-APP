"use client";

import { useMemo } from "react";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";

type DateBottomSheetPickerProps = {
  value: string;
  onChange: (value: string) => void;
  title: string;
  minDate: string;
  maxDate: string;
  placeholder?: string;
  buttonClassName?: string;
};

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateBottomSheetPicker({
  value,
  onChange,
  title,
  minDate,
  maxDate,
  placeholder = "Выберите дату",
  buttonClassName,
}: DateBottomSheetPickerProps) {
  const options = useMemo(() => {
    const start = parseLocalDate(minDate);
    const end = parseLocalDate(maxDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

    const result = [];
    const cursor = new Date(start);
    while (cursor <= end && result.length < 367) {
      result.push({
        value: toLocalIso(cursor),
        label: cursor.toLocaleDateString("ru-RU", {
          weekday: "short",
          day: "numeric",
          month: "long",
          year: cursor.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        }),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [maxDate, minDate]);

  return (
    <BottomSheetPicker
      value={value}
      onChange={onChange}
      options={options}
      title={title}
      placeholder={placeholder}
      buttonClassName={buttonClassName}
    />
  );
}
