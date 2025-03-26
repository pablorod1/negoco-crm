import { sendTramiteStatusUpdatedNotification } from "@/lib/hooks/update-tramite-status-notification-email";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const {
      user_to,
      tramite_id,
      status,
    }: {
      user_to: { email: string; name: string };
      tramite_id: string;
      status: { old: string; new: string };
    } = await req.json();

    const origin = req.headers.get("origin");
    await sendTramiteStatusUpdatedNotification({
      user_to,
      tramite_id,
      status,
      link: origin as string,
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
