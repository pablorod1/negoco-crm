import {
  TramiteViewToggle,
  TramiteView,
} from "@/tramites/components/editTramite/TramiteViewToggle";

interface TramiteNavigationProps {
  currentView: TramiteView;
  onViewChange: (view: TramiteView) => void;
}

export default function TramiteNavigation({
  currentView,
  onViewChange,
}: TramiteNavigationProps) {
  return (
    <div className="ms-4">
      <TramiteViewToggle
        currentView={currentView}
        onViewChange={onViewChange}
      />
    </div>
  );
}
