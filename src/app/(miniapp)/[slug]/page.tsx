import { redirect } from "next/navigation";
import { buildBusinessUrl } from "@/lib/production-url";

export default async function LegacyBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(buildBusinessUrl(slug));
}
