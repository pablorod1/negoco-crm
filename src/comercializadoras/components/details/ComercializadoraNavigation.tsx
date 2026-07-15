import {
  ComercializadoraViewToggle,
  ComercializadoraView,
} from "@/comercializadoras/components/details/ComercializadoraViewToggle";

interface ComercializadoraNavigationProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  showRates?: boolean;
}

export function ComercializadoraNavigation({
  currentView,
  onViewChange,
  showRates = false,
}: ComercializadoraNavigationProps) {
  return (
    <div className="ms-4">
      <ComercializadoraViewToggle
        currentView={currentView}
        onViewChange={onViewChange}
        showRates={showRates}
      />
    </div>
  );
}
