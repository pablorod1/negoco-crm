"use client";

import { useEffect, useState } from "react";
import { UserCompanyCommission } from "@/core/types";

export function useUserCompanyCommissions(userId?: string | null) {
  const [commissions, setCommissions] = useState<UserCompanyCommission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCommissions() {
      if (!userId) {
        setCommissions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/v2/users/${userId}/config`);
        const result = await response.json();

        if (!cancelled) {
          setCommissions(
            result.success ? (result.data?.company_commissions ?? []) : [],
          );
        }
      } catch (error) {
        console.error("Error fetching user company commissions:", error);
        if (!cancelled) setCommissions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCommissions();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { commissions, loading };
}
