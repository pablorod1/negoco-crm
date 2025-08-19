import { sendUpgradePlanEmail } from "@/core/hooks/upgrade-plan-email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      user,
      plan,
    }: {
      user: { email: string; name: string; company: string };
      plan: { old: string; new: string };
    } = await req.json();

    await sendUpgradePlanEmail({
      user: {
        name: user.name,
        email: user.email,
        company: user.company,
      },
      plan: {
        old: plan.old,
        new: plan.new,
      },
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
