import { sendWelcomeEmail } from "@/core/hooks/welcome-email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      user_to,
    }: {
      user_to: { email: string; name: string; org_logo: string | undefined };
    } = await req.json();

    const origin = req.headers.get("origin");
    const { success, error, info } = await sendWelcomeEmail({
      email_to: user_to.email,
      name: user_to.name,
      link: origin as string,
      req: req as NextRequest,
      org_logo: user_to.org_logo,
    });

    if (!success) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true, info }, { status: 200 });
  } catch (error) {
    console.error("Error enviando el email:", error);
    return NextResponse.json(
      { success: false, error: "Error enviando el email" },
      { status: 500 }
    );
  }
}
