import React from "react";
import {
  Layers2,
  Zap,
  Users,
  LayoutDashboard,
  Settings,
  Calendar,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AddTramiteDialog from "../tramites/createTramite/AddTramiteDialog";

export default function ShortcutsMenu() {
  const shortcuts = [
    {
      id: 1,
      icon: <LayoutDashboard size={24} />,
      label: "Dashboard",
      color:
        "bg-[var(--primary-color-200)] text-[var(--primary-color-800)] border-[var(--primary-color-100)]",
      link: <AddTramiteDialog shortcut />,
    },
    {
      id: 2,
      icon: <Users size={24} />,
      label: "Usuarios",
      color: "bg-purple-100 text-purple-600",
    },
    {
      id: 3,
      icon: <Settings size={24} />,
      label: "Configuración",
      color: "bg-gray-100 text-gray-600",
    },
    {
      id: 4,
      icon: <Calendar size={24} />,
      label: "Calendario",
      color: "bg-green-100 text-green-600",
    },
    {
      id: 5,
      icon: <FileText size={24} />,
      label: "Documentos",
      color: "bg-yellow-100 text-yellow-600",
    },
    {
      id: 6,
      icon: <MessageSquare size={24} />,
      label: "Mensajes",
      color: "bg-red-100 text-red-600",
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative px-2 hover:bg-gray-100 "
        >
          <Layers2 size={20} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0">
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b px-4 py-3 bg-gray-50">
            <CardTitle className="flex items-center gap-2 text-xl font-medium text-[var(--primary-color-800)]">
              <Zap size={20} className="text-yellow-500" />
              Acceso rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className={`${shortcut.color} relative flex items-center justify-center flex-col h-24 p-4 transition-all hover:scale-105 rounded-md border  shadow-md cursor-pointer`}
                >
                  {shortcut.link}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
