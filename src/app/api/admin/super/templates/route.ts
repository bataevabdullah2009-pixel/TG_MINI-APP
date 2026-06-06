import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TEMPLATES, type TemplateKey } from "@/lib/business-templates";
import { buildBusinessUrl } from "@/lib/production-url";

export async function GET() {
  const templates = await prisma.businessTemplate.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    templates.map((template) => {
      const seed = BUSINESS_TEMPLATES[template.key as TemplateKey];
      return {
        ...template,
        preview: buildBusinessUrl(seed?.previewSlug),
      };
    })
  );
}
