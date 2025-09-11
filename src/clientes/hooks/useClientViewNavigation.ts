import { useState } from "react";

export type ClientView = "main" | "tramites" | "files" | "tickets";

interface UseClientViewNavigationReturn {
  currentView: ClientView;
  setCurrentView: (view: ClientView) => void;
  resetToMain: () => void;
}

export function useClientViewNavigation(): UseClientViewNavigationReturn {
  const [currentView, setCurrentView] = useState<ClientView>("main");

  const resetToMain = () => {
    setCurrentView("main");
  };

  return {
    currentView,
    setCurrentView,
    resetToMain,
  };
}
