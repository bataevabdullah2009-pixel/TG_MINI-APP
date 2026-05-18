export type TemplateKey =
  | "cafe"
  | "barbershop"
  | "shop"
  | "grocery"
  | "hardware_store"
  | "carwash";

export type BusinessTemplateSeed = {
  key: TemplateKey;
  name: string;
  description: string;
  businessType: "CAFE" | "BARBERSHOP" | "SHOP" | "GROCERY" | "HARDWARE_STORE" | "CARWASH";
  orderMode: "cart/order" | "booking" | "request/order";
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
  icon: string;
  preview: string;
  categories: string[];
  items: Array<{
    category: string;
    name: string;
    description: string;
    price: number;
    type: "PRODUCT" | "SERVICE";
    durationMinutes?: number;
    stock?: number;
    isPopular?: boolean;
  }>;
};

export const BUSINESS_TEMPLATES: Record<TemplateKey, BusinessTemplateSeed> = {
  cafe: {
    key: "cafe",
    name: "Кафе / фастфуд",
    description: "Меню, категории, корзина, доставка или самовывоз, акции и уведомления продавцу.",
    businessType: "CAFE",
    orderMode: "cart/order",
    theme: { primaryColor: "#F97316", accentColor: "#F59E0B", backgroundColor: "#FFF7ED" },
    icon: "coffee",
    preview: "/app/demo-cafe",
    categories: ["Шаурма", "Бургеры", "Напитки", "Комбо"],
    items: [
      { category: "Шаурма", name: "Классическая шаурма с курицей", description: "Курица, свежие овощи и чесночный соус.", price: 250, type: "PRODUCT", isPopular: true },
      { category: "Бургеры", name: "Двойной чизбургер", description: "Две котлеты, чеддер, огурцы и фирменный соус.", price: 330, type: "PRODUCT", isPopular: true },
      { category: "Напитки", name: "Лимонад 0.5 л", description: "Холодный домашний лимонад.", price: 120, type: "PRODUCT" },
      { category: "Комбо", name: "Обеденное комбо", description: "Бургер, картофель и напиток.", price: 490, type: "PRODUCT" },
    ],
  },
  barbershop: {
    key: "barbershop",
    name: "Барбершоп / салон",
    description: "Услуги, мастера, запись по времени, календарь, напоминания и отзывы.",
    businessType: "BARBERSHOP",
    orderMode: "booking",
    theme: { primaryColor: "#1E293B", accentColor: "#64748B", backgroundColor: "#F8FAFC" },
    icon: "scissors",
    preview: "/app/demo-barber",
    categories: ["Стрижки", "Борода", "Комплексы"],
    items: [
      { category: "Стрижки", name: "Мужская стрижка", description: "Консультация, стрижка и укладка.", price: 1200, type: "SERVICE", durationMinutes: 45, isPopular: true },
      { category: "Борода", name: "Моделирование бороды", description: "Контур, тримминг и масло для бороды.", price: 800, type: "SERVICE", durationMinutes: 30, isPopular: true },
      { category: "Комплексы", name: "Стрижка + борода", description: "Полный комплекс ухода.", price: 1800, type: "SERVICE", durationMinutes: 75 },
    ],
  },
  shop: {
    key: "shop",
    name: "Локальный магазин",
    description: "Каталог, корзина, остатки, контакты и доставка.",
    businessType: "SHOP",
    orderMode: "cart/order",
    theme: { primaryColor: "#EC4899", accentColor: "#F43F5E", backgroundColor: "#FFF1F2" },
    icon: "shopping-bag",
    preview: "/app/demo-shop",
    categories: ["Новинки", "Одежда", "Аксессуары"],
    items: [
      { category: "Новинки", name: "Футболка oversize", description: "Плотный хлопок и свободная посадка.", price: 1499, type: "PRODUCT", stock: 45, isPopular: true },
      { category: "Одежда", name: "Куртка со светоотражателями", description: "Водоотталкивающая ткань и яркие детали.", price: 4899, type: "PRODUCT", stock: 12 },
      { category: "Аксессуары", name: "Кепка SmartBiz", description: "Классическая чёрная кепка с вышивкой.", price: 990, type: "PRODUCT", stock: 80 },
    ],
  },
  grocery: {
    key: "grocery",
    name: "Продуктовый магазин",
    description: "Категории продуктов, вес или количество, доставка, быстрые заказы и акции дня.",
    businessType: "GROCERY",
    orderMode: "cart/order",
    theme: { primaryColor: "#10B981", accentColor: "#34D399", backgroundColor: "#ECFDF5" },
    icon: "apple",
    preview: "/app/demo-grocery",
    categories: ["Овощи", "Фрукты", "Молочные", "Напитки"],
    items: [
      { category: "Фрукты", name: "Зелёные яблоки, кг", description: "Свежие кисло-сладкие яблоки на вес.", price: 189, type: "PRODUCT", stock: 100, isPopular: true },
      { category: "Овощи", name: "Огурцы, кг", description: "Свежие хрустящие огурцы.", price: 139, type: "PRODUCT", stock: 100 },
      { category: "Молочные", name: "Молоко цельное 1 л", description: "Свежее фермерское молоко 3.2%.", price: 119, type: "PRODUCT", stock: 50 },
    ],
  },
  hardware_store: {
    key: "hardware_store",
    name: "Хозмаг / товары для дома",
    description: "Каталог, поиск, заявки, крупные товары, консультация и связь с продавцом.",
    businessType: "HARDWARE_STORE",
    orderMode: "request/order",
    theme: { primaryColor: "#2563EB", accentColor: "#3B82F6", backgroundColor: "#EFF6FF" },
    icon: "wrench",
    preview: "/app/demo-hozmag",
    categories: ["Инструменты", "Электрика", "Сантехника", "Товары для дома"],
    items: [
      { category: "Инструменты", name: "Аккумуляторная дрель", description: "Дрель 12V с кейсом и двумя батареями.", price: 3590, type: "PRODUCT", stock: 15, isPopular: true },
      { category: "Электрика", name: "Умная RGB-лампа", description: "Wi-Fi лампа с управлением через приложение.", price: 890, type: "PRODUCT", stock: 40 },
      { category: "Товары для дома", name: "Набор саморезов 500 шт", description: "Популярные размеры в органайзере.", price: 490, type: "PRODUCT", stock: 60 },
    ],
  },
  carwash: {
    key: "carwash",
    name: "Автомойка / сервис",
    description: "Запись на услуги, выбор даты и времени, уведомления владельцу и статусы записи.",
    businessType: "CARWASH",
    orderMode: "booking",
    theme: { primaryColor: "#06B6D4", accentColor: "#0EA5E9", backgroundColor: "#ECFEFF" },
    icon: "car",
    preview: "/app/demo-carwash",
    categories: ["Мойка", "Химчистка", "Полировка", "Комплексы"],
    items: [
      { category: "Мойка", name: "Стандартная мойка", description: "Кузов, колёса, коврики и быстрая уборка салона.", price: 700, type: "SERVICE", durationMinutes: 30, isPopular: true },
      { category: "Химчистка", name: "Химчистка сидений", description: "Экспресс-химчистка сидений.", price: 2500, type: "SERVICE", durationMinutes: 90 },
      { category: "Полировка", name: "Полировка фар", description: "Восстановление прозрачности фар.", price: 1200, type: "SERVICE", durationMinutes: 40 },
    ],
  },
};

export function templateKeyFromBusinessType(type: string): TemplateKey {
  const normalized = type.toUpperCase();
  if (normalized === "CAFE") return "cafe";
  if (normalized === "BARBERSHOP") return "barbershop";
  if (normalized === "SHOP") return "shop";
  if (normalized === "GROCERY") return "grocery";
  if (normalized === "HARDWARE_STORE") return "hardware_store";
  if (normalized === "CARWASH") return "carwash";
  return "cafe";
}
