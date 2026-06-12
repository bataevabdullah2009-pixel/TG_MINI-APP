import { prisma } from "@/lib/prisma";
import {
  analyzePaymentProof,
  type PaymentProofAnalysisResult,
} from "@/lib/ai/payment-proof-analyzer";

const PAYMENT_PROOF_TIMEOUT_MS = 30_000;
const TIMEOUT_SUMMARY = "Проверка заняла больше 30 секунд. Нужна ручная проверка.";
const FAILED_SUMMARY = "ИИ не смог проверить чек. Проверьте оплату вручную.";

function fallbackAnalysis(
  orderTotal: number,
  recipientName: string | null,
  status: "MANUAL_REVIEW" | "AI_FAILED",
  summary: string
): PaymentProofAnalysisResult {
  return {
    extractedAmount: null,
    expectedAmount: orderTotal,
    amountMatches: null,
    extractedDate: null,
    extractedRecipient: null,
    expectedRecipient: recipientName,
    recipientMatches: null,
    extractedBank: null,
    confidencePercent: 0,
    status,
    reasonRu: summary,
    summary,
  };
}

export async function recoverStalePaymentProofChecks(input: {
  businessId?: string;
  orderId?: string;
} = {}) {
  const staleBefore = new Date(Date.now() - PAYMENT_PROOF_TIMEOUT_MS);
  return prisma.order.updateMany({
    where: {
      ...(input.businessId ? { businessId: input.businessId } : {}),
      ...(input.orderId ? { id: input.orderId } : {}),
      paymentProofAiStatus: { in: ["PENDING", "AI_CHECKING"] },
      paymentReviewedAt: null,
      createdAt: { lt: staleBefore },
    },
    data: {
      paymentProofAiStatus: "MANUAL_REVIEW",
      paymentProofAiSummary: TIMEOUT_SUMMARY,
      paymentProofAiConfidence: 0,
      paymentProofAiDetails: null,
    },
  });
}

export async function processPaymentProofAnalysis(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalPrice: true,
      createdAt: true,
      paymentMethod: true,
      paymentProofUrl: true,
      paymentProofMimeType: true,
      paymentProofAiStatus: true,
      paymentReviewedAt: true,
      business: {
        select: {
          name: true,
          transferRecipientName: true,
          transferPaymentPhone: true,
          transferBankName: true,
        },
      },
    },
  });

  if (
    !order ||
    order.paymentMethod !== "TRANSFER" ||
    !order.paymentProofUrl ||
    order.paymentReviewedAt ||
    !["PENDING", "AI_CHECKING"].includes(order.paymentProofAiStatus || "")
  ) {
    return;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<PaymentProofAnalysisResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(
        fallbackAnalysis(
          order.totalPrice,
          order.business.transferRecipientName,
          "MANUAL_REVIEW",
          TIMEOUT_SUMMARY
        )
      );
    }, PAYMENT_PROOF_TIMEOUT_MS);
  });

  let analysis: PaymentProofAnalysisResult;
  try {
    analysis = await Promise.race([
      analyzePaymentProof({
        imageUrl: order.paymentProofUrl,
        orderTotal: order.totalPrice,
        businessName: order.business.name,
        recipientName: order.business.transferRecipientName,
        paymentPhone: order.business.transferPaymentPhone,
        bankName: order.business.transferBankName,
        orderCreatedAt: order.createdAt,
        mimeType: order.paymentProofMimeType,
      }),
      timeoutResult,
    ]);
  } catch (error) {
    console.error("[PAYMENT PROOF AI] analysis failed:", error);
    analysis = fallbackAnalysis(
      order.totalPrice,
      order.business.transferRecipientName,
      "AI_FAILED",
      FAILED_SUMMARY
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  await prisma.order.updateMany({
    where: {
      id: order.id,
      paymentProofAiStatus: { in: ["PENDING", "AI_CHECKING"] },
      paymentReviewedAt: null,
    },
    data: {
      paymentProofAiStatus: analysis.status,
      paymentProofAiSummary: analysis.summary,
      paymentProofAiConfidence: analysis.confidencePercent,
      paymentProofAiDetails: JSON.stringify(analysis),
    },
  });
}
