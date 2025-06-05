import { sendFotovoltaicaStatusUpdatedNotification } from "@/lib/hooks/update-fotovoltaica-status-notification-email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      user_to,
      fotovoltaica_id,
      client,
      status,
    }: {
      user_to: { email: string; name: string; org_logo: string | undefined };
      fotovoltaica_id: string;
      status: { old: string; new: string };
      client: string;
    } = await req.json();

    const origin = req.headers.get("origin");
    await sendFotovoltaicaStatusUpdatedNotification({
      user_to,
      fotovoltaica_id,
      status,
      link: origin as string,
      req: req as NextRequest,
      client,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error enviando el email:", error);
    return NextResponse.json(
      { success: false, error: "Error enviando el email" },
      { status: 500 }
    );
  }
}
