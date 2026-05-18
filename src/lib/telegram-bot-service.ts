export class TelegramBotService {
  private token: string;
  private baseUrl: string;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || "";
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async sendNotification(chatId: string | number, message: string, options?: any) {
    if (!this.token || !chatId) {
      console.warn("Telegram notification skipped: token or chatId missing.");
      return;
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
        console.error(`Telegram API error (${response.status}):`, errorText);
      } else {
        console.log(`📨 Notification sent to ${chatId}`);
      }
    } catch (error) {
      console.error(`Failed to send notification to ${chatId}:`, error);
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
📦 <b>Новый заказ! #${orderNumber}</b>

<b>Клиент:</b> ${customerName}
<b>Телефон:</b> ${customerPhone}
<b>Сумма:</b> ${totalPrice} RUB

<a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/orders">Открыть в админке</a>
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
📅 <b>Новая запись!</b>

<b>Клиент:</b> ${customerName}
<b>Телефон:</b> ${customerPhone}
<b>Услуга:</b> ${serviceName}
<b>Время:</b> ${time}

<a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/bookings">Открыть в админке</a>
    `;

    await this.sendNotification(chatId, message);
  }
}

export const telegramBot = new TelegramBotService();
