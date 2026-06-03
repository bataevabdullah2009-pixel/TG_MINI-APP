import { redirect } from "next/navigation";

export default async function LegacyBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/app/${slug}`);
}

