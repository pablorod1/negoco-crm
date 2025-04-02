import { sendComparativaStatusUpdatedNotification } from "@/lib/hooks/update-comparativa-status-notification-email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      user_to,
      comparativa_id,
      status,
    }: {
      user_to: { email: string; name: string; org_logo: string | undefined };
      comparativa_id: string;
      status: { old: string; new: string };
    } = await req.json();

    const origin = req.headers.get("origin");
    await sendComparativaStatusUpdatedNotification({
      user_to,
      comparativa_id,
      status,
      link: origin as string,
      req: req as NextRequest,
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
