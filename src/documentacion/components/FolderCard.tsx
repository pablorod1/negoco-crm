"use client";

import { CheckCircle, CircleX, MoreVertical, Trash } from "lucide-react";
import { Link } from "next-view-transitions";

import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import Image from "next/image";
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
      const res = await fetch("/api/documentacion/delete/folder", {
        method: "POST",
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
    <Card className="relative overflow-hidden h-full flex items-center w-full">
      <CardContent className="p-4 w-full">
        <div className="flex items-start justify-between">
          <Link
            href={`/documentacion/${currentPath}/${name}`}
            className="flex items-center space-x-4 group"
          >
            <div className="w-14 h-14 relative">
              <Image
                src="/file-icons/folder.png"
                alt="Folder icon"
                width={512}
                height={512}
                className="max-w-14 w-full h-full"
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg group-hover:underline">
                {name}
              </h3>
            </div>
          </Link>
          {!isComercial && (
            <DropdownMenu modal>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash />
                    Eliminar carpeta
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
