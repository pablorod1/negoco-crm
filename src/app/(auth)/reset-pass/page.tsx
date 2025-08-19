"use client";
import ResetPassWrapper from "@/core/components/auth/reset-pass/ResetPassWrapper";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Reset() {
  const params = useSearchParams();
  const token = params.get("token");

  return <ResetPassWrapper token={token as string} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}

