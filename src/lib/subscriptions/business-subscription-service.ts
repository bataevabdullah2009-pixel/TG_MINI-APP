import { addDays, addMonths, differenceInCalendarDays } from "date-fns";
import {
  BusinessPaymentMethod,
  BusinessPaymentType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/notification-service";

export const COMMERCIAL_PLAN_ID = "plan-commercial";
export const COMMERCIAL_PLAN_NAME = "Commercial";
export const COMMERCIAL_SETUP_FEE_RUB = 30_000;
export const COMMERCIAL_MONTHLY_FEE_RUB = 3_000;
export const COMMERCIAL_BILLING_PERIOD_MONTHS = 1;
export const SUBSCRIPTION_GRACE_DAYS = 3;
export const TRIAL_DAYS = 14;
export const SUBSCRIPTION_EXPIRED_REASON = "Истёк срок подписки";
export const BUSINESS_BLOCKED_MESSAGE =
  "Магазин временно недоступен. Продавец должен продлить подписку.";
export const SELLER_BLOCKED_MESSAGE =
  "Доступ к бизнесу заблокирован. Свяжитесь с администратором Vitrina AI для продления.";

export type BusinessOperationAccess = {
  canViewCatalog: boolean;
  canCreateOrder: boolean;
  canManageProducts: boolean;
  canManageOrders: boolean;
  canUseAI: boolean;
  canUseDelivery: boolean;
  reason: string | null;
};

const subscriptionStateSelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  isBlocked: true,
  blockedReason: true,
  isArchived: true,
  isDeleted: true,
  subscriptionStatus: true,
  subscriptionEndDate: true,
  gracePeriodUntil: true,
} as const;

type SubscriptionState = Prisma.BusinessGetPayload<{
  select: typeof subscriptionStateSelect;
}>;

export async function ensureCommercialPlan(tx?: Prisma.TransactionClient) {
  const db = tx || prisma;
  return db.subscriptionPlan.upsert({
    where: { id: COMMERCIAL_PLAN_ID },
    update: {
      name: COMMERCIAL_PLAN_NAME,
      description:
        "Подключение 30 000 ₽ + 3 000 ₽/мес подписка. Каталог, заказы, ИИ, доставка, уведомления.",
      price: COMMERCIAL_MONTHLY_FEE_RUB,
      setupFeeAmount: COMMERCIAL_SETUP_FEE_RUB,
      monthlyFeeAmount: COMMERCIAL_MONTHLY_FEE_RUB,
      billingPeriodMonths: COMMERCIAL_BILLING_PERIOD_MONTHS,
      isActive: true,
    },
    create: {
      id: COMMERCIAL_PLAN_ID,
      name: COMMERCIAL_PLAN_NAME,
      description:
        "Подключение 30 000 ₽ + 3 000 ₽/мес подписка. Каталог, заказы, ИИ, доставка, уведомления.",
      price: COMMERCIAL_MONTHLY_FEE_RUB,
      setupFeeAmount: COMMERCIAL_SETUP_FEE_RUB,
      monthlyFeeAmount: COMMERCIAL_MONTHLY_FEE_RUB,
      billingPeriodMonths: COMMERCIAL_BILLING_PERIOD_MONTHS,
      maxItems: 1000,
      maxOrdersPerMonth: 10000,
      maxStaff: 20,
      features:
        '["catalog","orders","telegram-mini-app","ai","notifications","delivery"]',
      isActive: true,
    },
  });
}

function operationAccessForState(
  business: SubscriptionState
): BusinessOperationAccess {
  if (
    business.isArchived ||
    business.isDeleted ||
    business.subscriptionStatus === "ARCHIVED" ||
    !business.isActive
  ) {
    return {
      canViewCatalog: false,
      canCreateOrder: false,
      canManageProducts: false,
      canManageOrders: false,
      canUseAI: false,
      canUseDelivery: false,
      reason: "Бизнес временно недоступен.",
    };
  }

  const blocked =
    business.isBlocked ||
    business.subscriptionStatus === "BLOCKED" ||
    business.subscriptionStatus === "EXPIRED";

  if (blocked) {
    const reason =
      business.blockedReason === SUBSCRIPTION_EXPIRED_REASON
        ? BUSINESS_BLOCKED_MESSAGE
        : business.blockedReason || BUSINESS_BLOCKED_MESSAGE;
    return {
      canViewCatalog: true,
      canCreateOrder: false,
      canManageProducts: false,
      canManageOrders: false,
      canUseAI: false,
      canUseDelivery: false,
      reason,
    };
  }

  return {
    canViewCatalog: true,
    canCreateOrder: true,
    canManageProducts: true,
    canManageOrders: true,
    canUseAI: true,
    canUseDelivery: true,
    reason: null,
  };
}

export async function syncBusinessSubscriptionState(
  businessId: string,
  now = new Date()
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: subscriptionStateSelect,
  });
  if (!business) return null;

  if (
    business.isArchived ||
    business.isDeleted ||
    business.subscriptionStatus === "ARCHIVED" ||
    business.subscriptionStatus === "LIFETIME" ||
    !business.subscriptionEndDate
  ) {
    return business;
  }

  if (business.subscriptionEndDate > now) {
    return business;
  }

  const manualBlock =
    business.isBlocked &&
    Boolean(business.blockedReason) &&
    business.blockedReason !== SUBSCRIPTION_EXPIRED_REASON;
  if (manualBlock) return business;

  const gracePeriodUntil =
    business.gracePeriodUntil ||
    addDays(business.subscriptionEndDate, SUBSCRIPTION_GRACE_DAYS);
  const shouldBlock = gracePeriodUntil <= now;

  await prisma.business.updateMany({
    where: {
      id: business.id,
      subscriptionEndDate: { lte: now },
      isArchived: false,
      isDeleted: false,
    },
    data: shouldBlock
      ? {
          subscriptionStatus: "BLOCKED",
          isBlocked: true,
          blockedAt: business.isBlocked ? undefined : now,
          blockedReason: SUBSCRIPTION_EXPIRED_REASON,
          gracePeriodUntil,
        }
      : {
          subscriptionStatus: "PAST_DUE",
          isBlocked: false,
          blockedAt: null,
          blockedReason: null,
          gracePeriodUntil,
        },
  });

  return prisma.business.findUnique({
    where: { id: business.id },
    select: subscriptionStateSelect,
  });
}

export async function canBusinessOperate(
  businessId: string
): Promise<BusinessOperationAccess> {
  const business = await syncBusinessSubscriptionState(businessId);
  if (!business) {
    return {
      canViewCatalog: false,
      canCreateOrder: false,
      canManageProducts: false,
      canManageOrders: false,
      canUseAI: false,
      canUseDelivery: false,
      reason: "Бизнес не найден.",
    };
  }

  return operationAccessForState(business);
}

export function subscriptionDaysRemaining(
  subscriptionEndDate: Date | null,
  now = new Date()
) {
  if (!subscriptionEndDate) return null;
  return differenceInCalendarDays(subscriptionEndDate, now);
}

type RecordBusinessPaymentInput = {
  businessId: string;
  amount?: number;
  type: BusinessPaymentType;
  monthsAdded?: number;
  paidAt?: Date;
  createdByAdminId?: string | null;
  comment?: string | null;
  method?: BusinessPaymentMethod;
};

export async function recordBusinessPayment(
  input: RecordBusinessPaymentInput
) {
  const paidAt = input.paidAt || new Date();
  const monthsAdded = input.type === "MONTHLY" ? (input.monthsAdded || 1) : (input.monthsAdded || 0);

  const result = await prisma.$transaction(async (tx) => {
    await ensureCommercialPlan(tx);
    const business = await tx.business.findUnique({
      where: { id: input.businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        setupFeeAmount: true,
        monthlyFeeAmount: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        subscriptionStatus: true,
        isBlocked: true,
        blockedReason: true,
        gracePeriodUntil: true,
      },
    });
    if (!business) throw new Error("BUSINESS_NOT_FOUND");

    const isSetup = input.type === "SETUP";
    const isMonthlyRenewal = input.type === "MONTHLY" || input.type === "MANUAL" || input.type === "BONUS";
    const rawAmount =
      input.amount ??
      (isSetup
        ? business.setupFeeAmount
        : isMonthlyRenewal && monthsAdded > 0
          ? business.monthlyFeeAmount * monthsAdded
          : 0);
    const amount =
      input.type === "REFUND"
        ? -Math.abs(Math.round(rawAmount))
        : Math.round(rawAmount);
    if (
      !Number.isFinite(amount) ||
      amount === 0 ||
      (input.type !== "REFUND" && amount < 0)
    ) {
      throw new Error("INVALID_PAYMENT_AMOUNT");
    }

    const adminExists = input.createdByAdminId
      ? await tx.user.findUnique({
          where: { id: input.createdByAdminId },
          select: { id: true },
        })
      : null;

    const payment = await tx.businessPayment.create({
      data: {
        businessId: business.id,
        amount,
        type: input.type,
        monthsAdded,
        paidAt,
        method: input.method || "MANUAL",
        comment: input.comment?.trim() || null,
        createdByAdminId: adminExists?.id || null,
      },
    });

    let subscriptionUpdate: Record<string, unknown> = {
      lastPaidAt: paidAt,
      paymentComment: input.comment?.trim() || null,
    };

    if (isSetup) {
      const startDate = business.subscriptionStartDate || paidAt;
      const endDate = addMonths(startDate, COMMERCIAL_BILLING_PERIOD_MONTHS);
      subscriptionUpdate = {
        ...subscriptionUpdate,
        subscriptionPlanId: COMMERCIAL_PLAN_ID,
        setupFeeAmount: COMMERCIAL_SETUP_FEE_RUB,
        monthlyFeeAmount: COMMERCIAL_MONTHLY_FEE_RUB,
        subscriptionStatus: "ACTIVE",
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        nextPaymentAt: endDate,
        gracePeriodUntil: null,
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
        isActive: true,
        isArchived: false,
        archivedAt: null,
        isDeleted: false,
        deletedAt: null,
        subscriptionReminder3dSentAt: null,
        subscriptionReminder1dSentAt: null,
        subscriptionExpiredNoticeSentAt: null,
        subscriptionBlockedNoticeSentAt: null,
      };
    } else if (isMonthlyRenewal && monthsAdded > 0) {
      const currentEnd = business.subscriptionEndDate || paidAt;
      const baseDate = currentEnd > paidAt ? currentEnd : paidAt;
      const newEndDate = addMonths(baseDate, monthsAdded);
      subscriptionUpdate = {
        ...subscriptionUpdate,
        subscriptionStatus: "ACTIVE",
        subscriptionEndDate: newEndDate,
        nextPaymentAt: newEndDate,
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
        gracePeriodUntil: null,
        subscriptionReminder3dSentAt: null,
        subscriptionReminder1dSentAt: null,
        subscriptionExpiredNoticeSentAt: null,
        subscriptionBlockedNoticeSentAt: null,
      };
    }

    const updated = await tx.business.update({
      where: { id: business.id },
      data: subscriptionUpdate,
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        isBlocked: true,
      },
    });

    return { payment, business: updated };
  });

  if (input.type === "SETUP") {
    await NotificationService.notifySetupActivated(
      result.business.id
    ).catch((error) =>
      console.warn(
        `[SUBSCRIPTION] Setup activation notification failed for ${result.business.id}:`,
        error
      )
    );
  } else if (monthsAdded > 0) {
    await NotificationService.notifySubscriptionRenewed(
      result.business.id
    ).catch((error) =>
      console.warn(
        `[SUBSCRIPTION] Renewal notification failed for ${result.business.id}:`,
        error
      )
    );
  }

  return result;
}

export async function blockBusinessManually(
  businessId: string,
  reason: string
) {
  return prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: "BLOCKED",
      isBlocked: true,
      blockedAt: new Date(),
      blockedReason: reason.trim() || "Бизнес заблокирован администратором",
    },
  });
}

export async function unblockBusinessManually(businessId: string) {
  const current = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionPlanId: true,
      subscriptionStatus: true,
      subscriptionEndDate: true,
    },
  });
  if (!current) throw new Error("BUSINESS_NOT_FOUND");
  const now = new Date();
  const subscriptionExpired =
    Boolean(current.subscriptionEndDate) &&
    current.subscriptionEndDate! <= now;
  const lifetime = current.subscriptionStatus === "LIFETIME";

  return prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: lifetime
        ? "LIFETIME"
        : subscriptionExpired
          ? "PAST_DUE"
          : "ACTIVE",
      isBlocked: false,
      blockedAt: null,
      blockedReason: null,
      gracePeriodUntil: subscriptionExpired && !lifetime
        ? addDays(now, SUBSCRIPTION_GRACE_DAYS)
        : null,
      isActive: true,
    },
  });
}

export async function archiveBusiness(businessId: string) {
  return prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: "ARCHIVED",
      isArchived: true,
      archivedAt: new Date(),
      isActive: false,
    },
  });
}

export async function softDeleteBusiness(businessId: string) {
  return prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus: "ARCHIVED",
      isDeleted: true,
      deletedAt: new Date(),
      isArchived: true,
      archivedAt: new Date(),
      isActive: false,
    },
  });
}

export async function restoreBusiness(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionPlanId: true,
      subscriptionStatus: true,
      subscriptionEndDate: true,
    },
  });
  if (!business) throw new Error("BUSINESS_NOT_FOUND");

  const expired =
    Boolean(business.subscriptionEndDate) &&
    business.subscriptionEndDate! <= new Date();
  return prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStatus:
        business.subscriptionPlanId === COMMERCIAL_PLAN_ID ||
        business.subscriptionStatus === "LIFETIME"
          ? "LIFETIME"
          : expired
            ? "PAST_DUE"
            : "ACTIVE",
      isDeleted: false,
      deletedAt: null,
      isArchived: false,
      archivedAt: null,
      isActive: true,
      isBlocked: false,
      blockedAt: null,
      blockedReason: null,
    },
  });
}

export async function checkBusinessSubscriptions(now = new Date()) {
  const reminderCutoff = addDays(now, 3);
  const businesses = await prisma.business.findMany({
    where: {
      isArchived: false,
      isDeleted: false,
      subscriptionStatus: { notIn: ["LIFETIME", "ARCHIVED"] },
      subscriptionEndDate: { not: null, lte: reminderCutoff },
    },
    select: {
      id: true,
      name: true,
      monthlyFeeAmount: true,
      subscriptionEndDate: true,
      subscriptionStatus: true,
      isBlocked: true,
      subscriptionReminder3dSentAt: true,
      subscriptionReminder1dSentAt: true,
      subscriptionExpiredNoticeSentAt: true,
      subscriptionBlockedNoticeSentAt: true,
    },
  });

  const summary = {
    checked: businesses.length,
    reminders3d: 0,
    reminders1d: 0,
    expiredNotices: 0,
    pastDue: 0,
    blocked: 0,
  };

  for (const business of businesses) {
    const expiresAt = business.subscriptionEndDate;
    if (!expiresAt) continue;
    const msRemaining = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / 86_400_000);

    if (
      daysRemaining <= 3 &&
      daysRemaining > 1 &&
      !business.subscriptionReminder3dSentAt
    ) {
      const sent =
        await NotificationService.notifySubscriptionExpiring(
          business.id,
          3
        );
      if (sent) {
        await prisma.business.update({
          where: { id: business.id },
          data: { subscriptionReminder3dSentAt: now },
        });
        summary.reminders3d += 1;
      }
    }

    if (
      daysRemaining <= 1 &&
      daysRemaining > 0 &&
      !business.subscriptionReminder1dSentAt
    ) {
      const sent =
        await NotificationService.notifySubscriptionExpiring(
          business.id,
          1
        );
      if (sent) {
        await prisma.business.update({
          where: { id: business.id },
          data: { subscriptionReminder1dSentAt: now },
        });
        summary.reminders1d += 1;
      }
    }

    if (msRemaining <= 0 && !business.subscriptionExpiredNoticeSentAt) {
      const sent =
        await NotificationService.notifySubscriptionExpired(business.id);
      await NotificationService.notifySuperAdminsSubscriptionIssue(
        business.id,
        Math.max(0, Math.abs(daysRemaining)),
        business.monthlyFeeAmount,
        false
      );
      await prisma.business.update({
        where: { id: business.id },
        data: { subscriptionExpiredNoticeSentAt: now },
      });
      if (sent) summary.expiredNotices += 1;
    }

    const nextState = await syncBusinessSubscriptionState(business.id, now);
    if (!nextState) continue;
    if (nextState.subscriptionStatus === "PAST_DUE") {
      summary.pastDue += 1;
    }
    if (
      nextState.subscriptionStatus === "BLOCKED" &&
      !business.subscriptionBlockedNoticeSentAt
    ) {
      const sent =
        await NotificationService.notifySubscriptionBlocked(business.id);
      await NotificationService.notifySuperAdminsSubscriptionIssue(
        business.id,
        Math.max(0, Math.abs(daysRemaining)),
        business.monthlyFeeAmount,
        true
      );
      await prisma.business.update({
        where: { id: business.id },
        data: { subscriptionBlockedNoticeSentAt: now },
      });
      if (!sent) {
        console.warn(
          `[SUBSCRIPTION] Owner block notification was not delivered for ${business.id}.`
        );
      }
      summary.blocked += 1;
    }
  }

  return summary;
}
