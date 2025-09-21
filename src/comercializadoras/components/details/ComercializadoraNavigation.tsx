import {
  ComercializadoraViewToggle,
  ComercializadoraView,
} from "@/comercializadoras/components/details/ComercializadoraViewToggle";

interface ComercializadoraNavigationProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
}

export function ComercializadoraNavigation({
  currentView,
  onViewChange,
}: ComercializadoraNavigationProps) {
  return (
    <div className="ms-4">
      <ComercializadoraViewToggle
        currentView={currentView}
        onViewChange={onViewChange}
      />
    </div>
  );
}
