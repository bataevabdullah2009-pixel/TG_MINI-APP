import { useEffect, useState } from "react";

export function useTelegram() {
  const [tg, setTg] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const TelegramWebApp = (window as any).Telegram?.WebApp;
      if (TelegramWebApp) {
        TelegramWebApp.ready();
        setTg(TelegramWebApp);
        setUser(TelegramWebApp.initDataUnsafe?.user);
      }
    }
  }, []);

  return {
    tg,
    user,
    initDataUnsafe: tg?.initDataUnsafe,
    showAlert: tg?.showAlert?.bind(tg),
  };
}

export function useTelegramInitData() {
  const [initData, setInitData] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const data = (window as any).Telegram?.WebApp?.initData;
      if (data) {
        setInitData(data);
      }
    }
  }, []);

  return initData;
}

export function useTelegramTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const TelegramWebApp = (window as any).Telegram?.WebApp;
      if (TelegramWebApp) {
        setIsDark(TelegramWebApp.colorScheme === "dark");
        TelegramWebApp.onEvent("themeChanged", () => {
          setIsDark(TelegramWebApp.colorScheme === "dark");
        });
      }
    }
  }, []);

  return { isDark };
}
