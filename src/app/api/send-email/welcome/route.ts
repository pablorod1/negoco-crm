import { sendWelcomeEmail } from "@/lib/hooks/welcome-email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      user_to,
    }: {
      user_to: { email: string; name: string };
      tramite_id: string;
      status: { old: string; new: string };
    } = await req.json();

    const origin = req.headers.get("origin");
    await sendWelcomeEmail({
      email_to: user_to.email,
      name: user_to.name,
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
