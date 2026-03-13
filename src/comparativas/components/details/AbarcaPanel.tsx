"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Loader2, Stars, Lock } from "lucide-react";

interface AbarcaPanelProps {
  comparativaId: string;
  userId: string;
  abarcaUserId: number;
}

export function AbarcaPanel({
  comparativaId,
  userId,
  abarcaUserId,
}: AbarcaPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const res = await fetch(
          `/api/v2/integrations/abarca/session-status?user_id=${encodeURIComponent(userId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSessionBlocked(data.hasPendingSession && !data.isOwnSession);
      } catch {
        // On error, allow access (fail open)
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleOpen = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v2/integrations/abarca/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ide: 100,
          idcm: abarcaUserId,
          comparativa_id: comparativaId,
          user_id: userId,
        }),
      });

      if (!res.ok) {
        console.error("Error fetching Abarca login URL:", await res.text());
        return;
      }

      const data = await res.json();
      window.open(data.loginUrl, "_blank", "noopener,noreferrer");
    } catch {
      console.error("Error de conexión con Abarca");
    } finally {
      setIsLoading(false);
    }
  }, [abarcaUserId, comparativaId, userId]);

  return (
    <Button
      onClick={handleOpen}
      variant="default"
      size="sm"
      className="w-full"
      disabled={sessionBlocked || checkingSession || isLoading}
    >
      <span className="flex items-center gap-2">
        {checkingSession ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Comprobando disponibilidad...
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Conectando con Abarca...
          </>
        ) : sessionBlocked ? (
          <>
            <Lock className="h-4 w-4" />
            Otro usuario está realizando un estudio
          </>
        ) : (
          <>
            <Stars className="h-4 w-4" />
            Realizar estudio con IA
          </>
        )}
      </span>
    </Button>
  );
}
