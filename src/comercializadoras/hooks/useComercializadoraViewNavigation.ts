import { useCallback, useState } from "react";

export type ComercializadoraView =
  | "main"
  | "tramites"
  | "documentos"
  | "tarifas";

interface UseComercializadoraViewNavigationReturn {
  currentView: ComercializadoraView;
  setCurrentView: (view: ComercializadoraView) => void;
  resetToMain: () => void;
}

export function useComercializadoraViewNavigation(): UseComercializadoraViewNavigationReturn {
  const [currentView, setCurrentView] = useState<ComercializadoraView>("main");

  const resetToMain = useCallback(() => {
    setCurrentView("main");
  }, []);

  return {
    currentView,
    setCurrentView,
    resetToMain,
  };
}
