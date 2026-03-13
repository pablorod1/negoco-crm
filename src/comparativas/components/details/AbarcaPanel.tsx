"use client";

import { useCallback, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Loader2, Stars } from "lucide-react";

interface AbarcaPanelProps {
  comparativaId: string;
  abarcaUserId: number;
}

export function AbarcaPanel({ comparativaId, abarcaUserId }: AbarcaPanelProps) {
  const [isLoading, setIsLoading] = useState(false);

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
  }, [abarcaUserId, comparativaId]);

  return (
    <Button
      onClick={handleOpen}
      variant="default"
      size="sm"
      className="w-full"
      disabled={isLoading}
    >
      <span className="flex items-center gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Conectando con Abarca...
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
