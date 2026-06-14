import { prisma } from "@/lib/prisma";

export type ReviewSummary = {
  average: number;
  count: number;
};

export async function getPublishedReviewSummary(businessId: string): Promise<ReviewSummary> {
  const summary = await prisma.review.aggregate({
    where: { businessId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return {
    average: summary._avg.rating || 0,
    count: summary._count._all,
  };
}

export async function getPublishedReviewSummaryMap(businessIds: string[]) {
  const summaries = new Map<string, ReviewSummary>();
  if (businessIds.length === 0) return summaries;

  const grouped = await prisma.review.groupBy({
    by: ["businessId"],
    where: {
      businessId: { in: businessIds },
      status: "PUBLISHED",
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  for (const entry of grouped) {
    summaries.set(entry.businessId, {
      average: entry._avg.rating || 0,
      count: entry._count._all,
    });
  }

  return summaries;
}
