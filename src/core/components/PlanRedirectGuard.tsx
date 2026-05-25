"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/core/contexts/UserContext";

export function PlanRedirectGuard() {
  const { userData, loading } = useUser();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (loading || !userData || hasRedirected.current) return;

    const plan = userData.organization?.plan;

    if (plan === "comparador") {
      hasRedirected.current = true;
      const currentPath = window.location.pathname;
      if (currentPath === "/") {
        router.replace("/comparador");
      }
    }
  }, [userData, loading, router]);

  return null;
}
