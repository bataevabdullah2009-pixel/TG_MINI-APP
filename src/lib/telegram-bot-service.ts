import { buildAdminUrl } from "@/lib/production-url";

export class TelegramBotService {
  private token: string;
  private baseUrl: string;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || "";
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async sendNotification(chatId: string | number, message: string, options?: any): Promise<boolean> {
    if (!this.token || !chatId) {
      console.warn("Telegram notification skipped: token or chatId missing.");
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          ...options,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[TELEGRAM_RESPONSE_FAILED]", {
          chatId,
          status: response.status,
          responsePreview: errorText.slice(0, 500),
        });
        return false;
      }
      console.info("[TELEGRAM_RESPONSE_SENT]", {
        chatId,
        status: response.status,
        messageLength: message.length,
      });
      return true;
    } catch (error) {
      console.error(`Failed to send notification to ${chatId}:`, error);
      return false;
    }
  }

  async sendOrderNotification(
    chatId: string | number,
    orderId: string,
    orderNumber: string,
    totalPrice: number,
    customerName: string,
    customerPhone: string
  ) {
    const message = `
<b>Новый заказ! #${orderNumber}</b>

<b>Клиент:</b> ${customerName}
<b>Телефон:</b> ${customerPhone}
<b>Сумма:</b> ${totalPrice} RUB

<a href="${buildAdminUrl("/admin/orders")}">Открыть в админке</a>
    `;

    await this.sendNotification(chatId, message);
  }

  async sendBookingNotification(
    chatId: string | number,
    bookingId: string,
    customerName: string,
    customerPhone: string,
    serviceName: string,
    time: string
  ) {
    const message = `
<b>Новая запись!</b>

<b>Клиент:</b> ${customerName}
<b>Телефон:</b> ${customerPhone}
<b>Услуга:</b> ${serviceName}
<b>Время:</b> ${time}

<a href="${buildAdminUrl("/admin/bookings")}">Открыть в админке</a>
    `;

    await this.sendNotification(chatId, message);
  }
}

export const telegramBot = new TelegramBotService();
