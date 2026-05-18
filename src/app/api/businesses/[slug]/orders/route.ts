import { NextRequest } from "next/server";
import { POST as createOrder } from "@/app/api/orders/route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await request.json();
  return createOrder(
    new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...body, businessId: slug }),
    })
  );
}
