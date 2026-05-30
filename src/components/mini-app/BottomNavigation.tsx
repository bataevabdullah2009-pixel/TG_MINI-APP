"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

interface BottomNavigationProps {
  businessSlug: string;
  primaryColor?: string;
}

export function BottomNavigation({
  businessSlug,
  primaryColor = "#3B82F6",
}: BottomNavigationProps) {
  const pathname = usePathname();
  const cartCount = useCartStore((state) =>
    state.items.reduce((sum, i) => sum + i.quantity, 0)
  );

  const links = [
    { href: `/${businessSlug}`, label: "Главная", icon: "🏠" },
    { href: `/${businessSlug}/catalog`, label: "Каталог", icon: "📦" },
    {
      href: `/${businessSlug}/cart`,
      label: "Корзина",
      icon: "🛒",
      badge: cartCount > 0 ? cartCount : undefined,
    },
    { href: `/${businessSlug}/profile`, label: "Профиль", icon: "👤" },
    { href: `/${businessSlug}/contacts`, label: "Контакты", icon: "📍" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border max-w-md mx-auto shadow-lg pb-safe">
      <div className="flex justify-around">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== `/${businessSlug}` &&
              pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-xs font-medium transition-colors relative",
                isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
              style={{
                backgroundColor: isActive ? primaryColor : "transparent",
              }}
            >
              <span className="text-lg relative">
                {link.icon}
                {link.badge !== undefined && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                    style={{ backgroundColor: isActive ? "white" : primaryColor, color: isActive ? primaryColor : "white" }}
                  >
                    {link.badge > 9 ? "9+" : link.badge}
                  </span>
                )}
              </span>
              <span className="leading-tight">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
