"use client";
import EmptyToken from "@/components/auth/reset-pass/EmptyToken";
import ResetPassWrapper from "@/components/auth/reset-pass/ResetPassWrapper";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token");

  if (!token) {
    return <EmptyToken />;
  }

  return <ResetPassWrapper token={token} />;
}
