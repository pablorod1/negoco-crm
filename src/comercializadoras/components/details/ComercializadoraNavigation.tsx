import {
  ComercializadoraViewToggle,
  ComercializadoraView,
} from "@/comercializadoras/components/details/ComercializadoraViewToggle";

interface ComercializadoraNavigationProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  numTramites?: number;
  numFiles?: number;
}

export function ComercializadoraNavigation({
  currentView,
  onViewChange,
  numTramites,
  numFiles,
}: ComercializadoraNavigationProps) {
  return (
    <div className="ms-4">
      <ComercializadoraViewToggle
        currentView={currentView}
        onViewChange={onViewChange}
        numTramites={numTramites}
        numFiles={numFiles}
      />
    </div>
  );
}
