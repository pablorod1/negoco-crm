import {
  ClientViewToggle,
  ClientView,
} from "@/clientes/components/details/ClientViewToggle";

interface ClientNavigationProps {
  currentView: ClientView;
  onViewChange: (view: ClientView) => void;
}

export default function ClientNavigation({
  currentView,
  onViewChange,
}: ClientNavigationProps) {
  return (
    <div className="ms-4">
      <ClientViewToggle currentView={currentView} onViewChange={onViewChange} />
    </div>
  );
}
