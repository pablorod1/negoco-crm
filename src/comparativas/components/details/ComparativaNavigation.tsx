import {
  ComparativaViewToggle,
  ComparativaView,
} from "@/comparativas/components/editComparativa/ComparativaViewToggle";

interface ComparativaNavigationProps {
  currentView: ComparativaView;
  onViewChange: (view: ComparativaView) => void;
  isAdmin?: boolean;
}

export default function ComparativaNavigation({
  currentView,
  onViewChange,
  isAdmin = true,
}: ComparativaNavigationProps) {
  return (
    <div className="ms-4">
      <ComparativaViewToggle
        currentView={currentView}
        onViewChange={onViewChange}
        isAdmin={isAdmin}
      />
    </div>
  );
}
