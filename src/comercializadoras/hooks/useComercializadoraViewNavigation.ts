import { useCallback, useState } from "react";

export type ComercializadoraView = "tramites" | "documentos";

export const DEFAULT_COMERCIALIZADORA_VIEW: ComercializadoraView = "tramites";

interface UseComercializadoraViewNavigationReturn {
  currentView: ComercializadoraView;
  setCurrentView: (view: ComercializadoraView) => void;
  resetToDefault: () => void;
}

export function useComercializadoraViewNavigation(): UseComercializadoraViewNavigationReturn {
  const [currentView, setCurrentView] = useState<ComercializadoraView>(
    DEFAULT_COMERCIALIZADORA_VIEW
  );

  const resetToDefault = useCallback(() => {
    setCurrentView(DEFAULT_COMERCIALIZADORA_VIEW);
  }, []);

  return {
    currentView,
    setCurrentView,
    resetToDefault,
  };
}
