"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useUser } from "@/core/contexts/UserContext";

export default function ComparadorPage() {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userData, loading } = useUser();
  const router = useRouter();
  const hasFetchedLogin = useRef(false);

  const fetchStandaloneLogin = useCallback(async () => {
    if (!userData?.organization?.abarca_user_id) {
      setError("Configuración de comparador no disponible");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/integrations/abarca/standalone-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idcm: userData.organization.abarca_user_id,
        }),
      });

      if (!res.ok) {
        console.error(
          "Error fetching Abarca standalone login:",
          await res.text(),
        );
        setError("No se pudo conectar con el comparador");
        return;
      }

      const data = await res.json();
      setIframeUrl(data.loginUrl);
    } catch {
      setError("Error de conexión con el comparador");
    } finally {
      setIsLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    if (loading) return;

    if (userData?.organization?.plan !== "comparador") {
      router.replace("/");
      return;
    }

    if (userData && !hasFetchedLogin.current) {
      hasFetchedLogin.current = true;
      fetchStandaloneLogin();
    }
  }, [userData, loading, router, fetchStandaloneLogin]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-white">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            <p className="text-sm text-gray-500">Cargando comparador...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={fetchStandaloneLogin}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reintentar
            </button>
          </div>
        </div>
      )}

      {iframeUrl && (
        <iframe
          src={iframeUrl}
          title="Comparador Energético"
          className="w-full h-full border-0"
          onLoad={() => setIsLoading(false)}
        />
      )}
    </div>
  );
}
