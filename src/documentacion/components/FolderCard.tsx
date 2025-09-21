"use client";

import {
  CheckCircle,
  CircleX,
  MoreVertical,
  Trash,
  Folder,
} from "lucide-react";
import { Link } from "next-view-transitions";

import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { showCustomToast } from "@/core/components/CustomToast";
import { User } from "@/core/types";

interface FolderCardProps {
  name: string;
  currentPath: string;
  userData: User;
}

export function FolderCard({ name, currentPath, userData }: FolderCardProps) {
  const { refreshDocumentacion } = useDocumentacion();
  const isComercial = userData && userData.role === "2";

  const handleDelete = async () => {
    try {
      const res = await fetch("/api/v2/document-library/folders", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_path: `${currentPath ? `${currentPath}/` : ""}${name}`,
          organization_id: userData.organization.id,
        }),
      });

      const { success, errors } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error eliminando carpeta",
          message: errors[0],
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Carpeta eliminada",
        message: "La carpeta ha sido eliminada correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      refreshDocumentacion();
    } catch (error) {
      console.error("Error eliminando carpeta:", error);
      showCustomToast({
        title: "Error eliminando carpeta",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    }
  };

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-gray-200 hover:border-gray-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Folder Icon */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Folder className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          {/* Folder Content */}
          <div className="flex-1 min-w-0">
            <Link
              href={`/documentacion/${currentPath}/${name}`}
              className="block group/link"
            >
              <h3 className="font-semibold text-gray-900 truncate group-hover/link:text-blue-600 transition-colors">
                {name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Carpeta</p>
            </Link>
          </div>

          {/* Actions */}
          {!isComercial && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-40 p-1 border-gray-200 shadow-lg"
                >
                  <Button
                    variant="ghost"
                    onClick={handleDelete}
                    className="w-full justify-start h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash className="h-4 w-4 mr-3" />
                    Eliminar
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
