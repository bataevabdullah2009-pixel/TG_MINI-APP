import { AIProvider } from "./provider";

export class MockAIProvider implements AIProvider {
  name = "mock";

  async generateFAQAnswer(input: {
    businessName: string;
    businessType: string;
    knowledgeBase: string;
    customerQuestion: string;
  }): Promise<string> {
    return `${input.businessName}: спасибо за ваш вопрос. Наш менеджер уже проверяет детали по вашему запросу и ответит вам в ближайшее время!`;
  }

  async generateContent(input: {
    businessName: string;
    businessType: string;
    contentType: string;
    productOrService?: string;
    tone?: string;
    goal?: string;
    businessPhone?: string;
    businessUsername?: string;
  }): Promise<string> {
    if (input.contentType === "product_card" || input.contentType === "productCard") {
      return JSON.stringify({
        name: input.productOrService || "Капучино ИИ",
        description: `Замечательный выбор для любителей качественных решений в ${input.businessName}. Обладает неповторимым вкусом и дарит заряд бодрости на весь день.`,
        category: "Кофе",
        marketingText: `Попробуйте нашу новинку — ${input.productOrService || "Капучино ИИ"} всего за 199 ₽! Заказывайте прямо в Telegram Mini App! ☕`,
        imagePrompt: `professional photography of ${input.productOrService || "cappuccino cup"}, warm lighting, cozy cafe background, 8k, photorealistic`
      });
    }
    const subject = input.productOrService?.trim() || "наших услуг";
    const phoneText = input.businessPhone ? `\n📞 Телефон: ${input.businessPhone}` : "";
    const usernameText = input.businessUsername ? `\n✈️ Наш Telegram: @${input.businessUsername.replace("@", "")}` : "";
    const toneText = input.tone || "дружелюбный";

    const typeLabels: Record<string, string> = {
      CAFE: "нашем уютном кафе",
      BARBERSHOP: "нашем профессиональном барбершопе",
      SHOP: "нашем магазине",
      GROCERY: "нашем магазине продуктов",
      HARDWARE_STORE: "нашем строительном магазине",
      CARWASH: "нашей автомойке",
    };

    const placeLabel = typeLabels[input.businessType] || "нашей компании";

    // Handle review replies
    if (input.contentType.includes("отзыв") || input.contentType === "review_reply") {
      return [
        `🌟 Ответ на ваш отзыв от команды ${input.businessName}!`,
        "",
        `Здравствуйте! Благодарим вас за то, что уделили время и поделились своим мнением. Мы безумно рады, что вам понравилось в ${placeLabel}!`,
        "",
        `Ваш отзыв вдохновляет нас становиться еще лучше и радовать вас высочайшим качеством сервиса каждый день. Будем счастливы видеть вас снова!`,
        "",
        "С теплыми пожеланиями,",
        `Команда ${input.businessName}`,
        phoneText,
        usernameText,
      ].filter(Boolean).join("\n");
    }

    // Handle promos
    if (input.contentType.includes("акция") || input.contentType === "promo") {
      return [
        `🔥 СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ в ${input.businessName}! 🔥`,
        "",
        `Спешим порадовать вас отличной акцией: ${subject}!`,
        "",
        `Только в эти дни мы подготовили лучшие условия и безупречный сервис в ${placeLabel}. Это отличный повод заглянуть к нам и воспользоваться моментом с максимальной выгодой!`,
        "",
        `✨ Тон публикации: ${toneText}`,
        "⚡️ Предложение ограничено, успейте забронировать или оформить заказ!",
        phoneText,
        usernameText,
      ].filter(Boolean).join("\n");
    }

    // Handle 7-day content ideas
    if (input.contentType.includes("идеи") || input.contentType === "ideas") {
      return [
        `📅 Контент-план на 7 дней для ${input.businessName} (Тон: ${toneText})`,
        "",
        `День 1: 🌟 Приветственный пост и философия ${input.businessName}. Почему выбирают нас?`,
        `День 2: 🛍️ Обзор популярной позиции: ${subject}. Описание, польза и цена.`,
        `День 3: 💡 Полезный совет или лайфхак по теме бизнеса для наших подписчиков.`,
        `День 4: 🔥 Акция недели или спецпредложение для постоянных клиентов.`,
        `День 5: 👥 Знакомство с нашей командой. Покажем рабочие будни изнутри.`,
        `День 6: 💬 Ответы на частые вопросы клиентов (FAQ) и полезные контакты.`,
        `День 7: 📈 Воскресный интерактив / опрос: узнаем предпочтения наших гостей.`,
        "",
        `Контакты для связи в публикациях:${phoneText}${usernameText}`,
      ].filter(Boolean).join("\n");
    }

    // Default Telegram post
    return [
      `📢 Прекрасные новости от ${input.businessName}! ✨`,
      "",
      `Друзья, рады сообщить вам отличные новости! Сегодня в центре внимания — ${subject}.`,
      "",
      `Мы в ${placeLabel} делаем всё возможное, чтобы каждый визит или заказ доставлял вам искреннее удовольствие. Гарантируем первоклассное качество и только положительные эмоции!`,
      "",
      `Ждем вас в гости! Наша команда сделает ваш день чуточку приятнее 🤍`,
      phoneText,
      usernameText,
    ].filter(Boolean).join("\n");
  }

  async generateProductDescription(input: {
    businessName: string;
    productName: string;
    productCategory?: string;
    productFeatures?: string;
    tone?: string;
  }): Promise<string> {
    return `🔥 ${input.productName} — хит продаж в ${input.businessName}! ${input.productFeatures || "Идеальный выбор для ценителей безупречного качества. Создано с любовью и вниманием к каждой детали специально для наших дорогих клиентов."}`;
  }
}
