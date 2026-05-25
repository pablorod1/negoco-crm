"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/core/contexts/UserContext";

interface PlanGuardProps {
  children: React.ReactNode;
  allowedPlans: string[];
  redirectTo?: string;
}

export function PlanGuard({
  children,
  allowedPlans,
  redirectTo = "/comparador",
}: PlanGuardProps) {
  const { userData, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !userData) return;

    const userPlan = userData.organization?.plan;
    if (userPlan && !allowedPlans.includes(userPlan)) {
      router.replace(redirectTo);
    }
  }, [userData, loading, allowedPlans, redirectTo, router]);

  if (loading || !userData) return null;

  const userPlan = userData.organization?.plan;
  if (userPlan && !allowedPlans.includes(userPlan)) {
    return null;
  }

  return <>{children}</>;
}
