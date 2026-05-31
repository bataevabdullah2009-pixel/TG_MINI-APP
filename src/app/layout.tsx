import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TelebiznezHub - Telegram Mini App Platform",
  description: "White-label Telegram Mini App platform for local businesses",
  icons: {
    icon: "/logo.svg",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <meta name="theme-color" content="#3B82F6" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
