import { NextRequest } from "next/server";
import { POST as createBooking } from "@/app/api/bookings/route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await request.json();
  return createBooking(
    new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...body, businessId: slug }),
    })
  );
}
