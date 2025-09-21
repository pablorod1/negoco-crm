import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";
import { Home, MessageSquare, FileText, History } from "lucide-react";

type ViewType = "main" | "tickets" | "files" | "history";

interface FotovoltaicaNavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isAdmin?: boolean;
}

const navigationItems = [
  {
    id: "main" as ViewType,
    label: "Principal",
    icon: Home,
  },
  {
    id: "tickets" as ViewType,
    label: "Notas",
    icon: MessageSquare,
  },
  {
    id: "files" as ViewType,
    label: "Archivos",
    icon: FileText,
  },
  {
    id: "history" as ViewType,
    label: "Historial",
    icon: History,
    adminOnly: true,
  },
];

export default function FotovoltaicaNavigation({
  currentView,
  onViewChange,
  isAdmin = false,
}: FotovoltaicaNavigationProps) {
  return (
    <div className=" flex items-center gap-1 bg-gray-50 rounded-4xl">
      {navigationItems
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <Button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              variant="ghost"
              size={"lg"}
              className={cn(
                "flex items-center gap-2 px-3 py-2 h-8 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary-900 text-white shadow-sm hover:bg-primary-800 hover:text-white"
                  : "text-gray-600 hover:text-primary-900 hover:bg-primary-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
    </div>
  );
}
