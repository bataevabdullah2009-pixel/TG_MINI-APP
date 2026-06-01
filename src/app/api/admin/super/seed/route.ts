import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { BUSINESS_TEMPLATES, type TemplateKey } from "@/lib/business-templates";
import { getAdminSession, jsonError, requireRole } from "@/lib/admin-auth";

const DEMO_BUSINESSES: Array<{
  slug: string;
  name: string;
  templateKey: TemplateKey;
  ownerEmail: string;
}> = [
  { slug: "demo-cafe", name: "Демо Кафе", templateKey: "cafe", ownerEmail: "owner-cafe@example.com" },
  { slug: "demo-barber", name: "Демо Барбершоп", templateKey: "barbershop", ownerEmail: "owner-barber@example.com" },
  { slug: "demo-shop", name: "Демо Магазин", templateKey: "shop", ownerEmail: "owner-shop@example.com" },
  { slug: "demo-grocery", name: "Демо Продукты", templateKey: "grocery", ownerEmail: "owner-grocery@example.com" },
  { slug: "demo-hozmag", name: "Демо Хозмаг", templateKey: "hardware_store", ownerEmail: "owner-hozmag@example.com" },
  { slug: "demo-carwash", name: "Демо Автомойка", templateKey: "carwash", ownerEmail: "owner-carwash@example.com" },
];

async function runSeedProcess() {
  console.log("🚀 Seeding database with demo data...");

  // 1. Create Plans
  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { id: "plan-start" },
      update: {},
      create: {
        id: "plan-start",
        name: "START",
        description: "Launch plan for a small local business.",
        price: 0,
        maxItems: 50,
        maxOrdersPerMonth: 200,
        maxStaff: 1,
        features: JSON.stringify(["catalog", "cart", "basic_ai"]),
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: "plan-pro" },
      update: {},
      create: {
        id: "plan-pro",
        name: "PRO",
        description: "Growth plan with AI and analytics.",
        price: 9900,
        maxItems: 300,
        maxOrdersPerMonth: 2000,
        maxStaff: 5,
        features: JSON.stringify(["catalog", "cart", "booking", "ai", "analytics"]),
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: "plan-business" },
      update: {},
      create: {
        id: "plan-business",
        name: "BUSINESS",
        description: "Advanced plan for multi-staff operations.",
        price: 29900,
        maxItems: 10000,
        maxOrdersPerMonth: 50000,
        maxStaff: 20,
        features: JSON.stringify(["all_templates", "ai", "staff", "integrations", "priority_support"]),
      },
    }),
  ]);

  // 2. Upsert Super Admin User
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      password: await bcrypt.hash("admin123", 10),
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      email: "admin@example.com",
      password: await bcrypt.hash("admin123", 10),
      name: "SmartBiz Super Admin",
      username: "superadmin",
      role: "SUPER_ADMIN",
      isActive: true,
    },
    select: { id: true },
  });

  // 3. Seeding Templates
  for (const template of Object.values(BUSINESS_TEMPLATES)) {
    await prisma.businessTemplate.upsert({
      where: { key: template.key },
      update: {
        name: template.name,
        description: template.description,
        businessType: template.businessType,
        orderMode: template.orderMode,
        defaultCategories: JSON.stringify(template.categories),
        defaultItems: JSON.stringify(template.items),
        theme: JSON.stringify(template.theme),
        icon: template.icon,
        preview: template.preview,
        isActive: true,
      },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        businessType: template.businessType,
        orderMode: template.orderMode,
        defaultCategories: JSON.stringify(template.categories),
        defaultItems: JSON.stringify(template.items),
        theme: JSON.stringify(template.theme),
        icon: template.icon,
        preview: template.preview,
        isActive: true,
      },
    });
  }

  // 4. Seeding Demo Businesses
  for (const demo of DEMO_BUSINESSES) {
    const template = BUSINESS_TEMPLATES[demo.templateKey];
    
    const owner = await prisma.user.upsert({
      where: { email: demo.ownerEmail },
      update: {
        password: await bcrypt.hash("owner123", 10),
        role: "BUSINESS_OWNER",
        isActive: true,
      },
      create: {
        email: demo.ownerEmail,
        password: await bcrypt.hash("owner123", 10),
        name: `Владелец ${demo.name}`,
        username: demo.ownerEmail.split("@")[0],
        role: "BUSINESS_OWNER",
        isActive: true,
      },
      select: { id: true },
    });

    const business = await prisma.business.upsert({
      where: { slug: demo.slug },
      update: {
        name: demo.name,
        type: template.businessType,
        templateKey: template.key,
        ownerId: owner.id,
        description: template.description,
        primaryColor: template.theme.primaryColor,
        accentColor: template.theme.accentColor,
        backgroundColor: template.theme.backgroundColor,
        subscriptionStatus: "ACTIVE",
        subscriptionPlanId: demo.templateKey === "cafe" ? plans[0].id : plans[1].id,
        isActive: true,
        aiProvider: "mock",
        aiEnabled: true,
        aiDailyLimit: 30,
        aiMonthlyLimit: 900,
        modulesEnabled:
          template.orderMode === "booking"
            ? "booking,staff,profile,calendar"
            : "catalog,cart,delivery,pickup,profile",
      },
      create: {
        slug: demo.slug,
        name: demo.name,
        type: template.businessType,
        templateKey: template.key,
        ownerId: owner.id,
        description: template.description,
        primaryColor: template.theme.primaryColor,
        accentColor: template.theme.accentColor,
        backgroundColor: template.theme.backgroundColor,
        phone: "+7 (999) 100-20-30",
        email: demo.ownerEmail,
        address: "Демо-улица, 1",
        telegramUsername: demo.slug,
        currency: "RUB",
        language: "ru",
        subscriptionStatus: "ACTIVE",
        subscriptionPlanId: demo.templateKey === "cafe" ? plans[0].id : plans[1].id,
        isActive: true,
        aiProvider: "mock",
        aiEnabled: true,
        aiDailyLimit: 30,
        aiMonthlyLimit: 900,
        modulesEnabled:
          template.orderMode === "booking"
            ? "booking,staff,profile,calendar"
            : "catalog,cart,delivery,pickup,profile",
      },
      select: { id: true, slug: true },
    });

    await prisma.user.update({
      where: { id: owner.id },
      data: { businessId: business.id },
      select: { id: true },
    });

    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      update: {
        deliveryEnabled: template.orderMode !== "booking",
        pickupEnabled: true,
        bookingEnabled: template.orderMode === "booking",
        deliveryFee: demo.templateKey === "cafe" || demo.templateKey === "grocery" ? 150 : 0,
      },
      create: {
        businessId: business.id,
        deliveryEnabled: template.orderMode !== "booking",
        pickupEnabled: true,
        bookingEnabled: template.orderMode === "booking",
        deliveryFee: demo.templateKey === "cafe" || demo.templateKey === "grocery" ? 150 : 0,
        notificationsEnabled: true,
      },
    });

    // Clear existing child data for idempotency
    await prisma.orderItem.deleteMany({ where: { order: { businessId: business.id } } });
    await prisma.order.deleteMany({ where: { businessId: business.id } });
    await prisma.booking.deleteMany({ where: { businessId: business.id } });
    await prisma.staff.deleteMany({ where: { businessId: business.id } });
    await prisma.item.deleteMany({ where: { businessId: business.id } });
    await prisma.category.deleteMany({ where: { businessId: business.id } });

    const categoryIds = new Map<string, string>();
    for (const [index, categoryName] of template.categories.entries()) {
      const category = await prisma.category.create({
        data: { businessId: business.id, name: categoryName, sortOrder: index + 1, isActive: true },
      });
      categoryIds.set(categoryName, category.id);
    }

    await prisma.item.createMany({
      data: template.items.map((item, index) => ({
        businessId: business.id,
        categoryId: categoryIds.get(item.category),
        type: item.type,
        name: item.name,
        description: item.description,
        price: item.price,
        durationMinutes: item.durationMinutes,
        stock: item.stock,
        isAvailable: true,
        isPopular: item.isPopular || false,
        sortOrder: index + 1,
      })),
    });

    const customer = await prisma.customer.upsert({
      where: { businessId_telegramUserId: { businessId: business.id, telegramUserId: BigInt(100000 + DEMO_BUSINESSES.indexOf(demo)) } },
      update: {
        name: "Демо Клиент",
        phone: "+7 (999) 000-00-01",
        username: "demo_customer",
      },
      create: {
        businessId: business.id,
        telegramUserId: BigInt(100000 + DEMO_BUSINESSES.indexOf(demo)),
        name: "Демо Клиент",
        phone: "+7 (999) 000-00-01",
        username: "demo_customer",
      },
    });

    if (template.orderMode === "booking") {
      const staff = await prisma.staff.create({
        data: {
          businessId: business.id,
          name: demo.templateKey === "carwash" ? "Бокс 1" : "Мастер Алексей",
          role: demo.templateKey === "carwash" ? "Пост обслуживания" : "Старший мастер",
          isActive: true,
        },
      });

      const service = await prisma.item.findFirst({ where: { businessId: business.id, type: "SERVICE" } });
      if (service) {
        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(11, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + (service.durationMinutes || 60) * 60000);
        await prisma.booking.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            serviceId: service.id,
            staffId: staff.id,
            customerName: customer.name || "Демо Клиент",
            customerPhone: customer.phone || "+7 (999) 000-00-01",
            startTime,
            endTime,
            status: "CONFIRMED",
            comment: "Демо-запись",
          },
        });
      }
    } else {
      const product = await prisma.item.findFirst({ where: { businessId: business.id, type: "PRODUCT" } });
      if (product) {
        await prisma.order.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            customerName: customer.name || "Демо Клиент",
            customerPhone: customer.phone || "+7 (999) 000-00-01",
            status: "COMPLETED",
            deliveryType: "PICKUP",
            totalPrice: product.price,
            comment: "Демо-заказ",
            items: {
              create: [{ itemId: product.id, name: product.name, price: product.price, quantity: 1 }],
            },
          },
        });
      }
    }
  }

  console.log("✅ Seeding completed successfully!");
}

// 1. Secure POST handler for Admin Console
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав для выполнения этой операции.", 403);
    }

    await runSeedProcess();

    return NextResponse.json({
      success: true,
      message: "База данных успешно заполнена демо-данными."
    });
  } catch (error: any) {
    console.error("❌ Seeding failed:", error);
    return NextResponse.json({ error: "Не удалось заполнить базу демо-данными. Подробности записаны в server logs." }, { status: 500 });
  }
}

// 2. Open GET handler for direct browser bootstrapper
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session || !requireRole(session, ["SUPER_ADMIN"])) {
      return jsonError("Недостаточно прав для выполнения этой операции.", 403);
    }

    console.log("⚡ Executing db seed bootstrapper via GET request...");
    
    await runSeedProcess();

    return NextResponse.json({
      success: true,
      message: "База данных успешно инициализирована и заполнена демо-данными!",
      nextSteps: {
        adminUrl: "/admin/login",
        superAdminCredentials: "admin@example.com / admin123",
        demoBusinessCredentials: "owner-cafe@example.com / owner123",
      }
    });
  } catch (error: any) {
    console.error("❌ GET Seeding failed:", error);
    return NextResponse.json({ error: "Не удалось инициализировать демо-данные. Подробности записаны в server logs." }, { status: 500 });
  }
}
