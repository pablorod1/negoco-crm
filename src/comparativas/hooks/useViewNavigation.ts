import { useState } from "react";
import type { ComparativaView } from "@/comparativas/components/editComparativa/ComparativaViewToggle";

interface UseViewNavigationReturn {
  currentView: ComparativaView;
  setCurrentView: (view: ComparativaView) => void;
  resetToMain: () => void;
}

export function useViewNavigation(): UseViewNavigationReturn {
  const [currentView, setCurrentView] = useState<ComparativaView>("main");

  const resetToMain = () => {
    setCurrentView("main");
  };

  return {
    currentView,
    setCurrentView,
    resetToMain,
  };
}
