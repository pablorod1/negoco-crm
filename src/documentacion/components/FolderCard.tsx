"use client";

import { useState } from "react";
import {
  CheckCircle,
  CircleX,
  FolderInput,
  MoreVertical,
  Pencil,
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
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { ComercializadoraVM } from "@/comercializadoras/types";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import { describeMutationError } from "@/documentacion/lib/document-library-api";
import { moveDocumentLibraryFolder } from "@/documentacion/lib/move-client";
import type { MoveProgress } from "@/documentacion/lib/move-types";
import { folderAncestors } from "@/documentacion/lib/folder-tree";
import { MoveToFolderDialog } from "./MoveToFolderDialog";
import { RenameFolderDialog } from "./RenameFolderDialog";
import { DeleteFolderConfirmationDialog } from "./DeleteFolderConfirmationDialog";

interface FolderCardProps {
  name: string;
  currentPath: string;
  userData: User;
  /** Carpeta de una comercializadora: se pinta con su logo y no se toca. */
  supplier?: Pick<ComercializadoraVM, "name" | "logo" | "active">;
  /** `false` para carpetas virtuales que aún no existen en Storage. */
  exists?: boolean;
  /** Navegación dentro de un explorador embebido en vez de por URL. */
  onNavigate?: (folderPath: string) => void;
}

type FolderDialog = "move" | "rename" | "delete" | null;

export function FolderCard({
  name,
  currentPath,
  userData,
  supplier,
  exists = true,
  onNavigate,
}: FolderCardProps) {
  const { refreshDocumentacion } = useDocumentacion();
  const [dialog, setDialog] = useState<FolderDialog>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isComercial = userData && userData.role === "2";
  const folderPath = normalizeDocumentLibraryFolderPath(
    `${currentPath}/${name}`
  );
  const parentPath = folderAncestors(folderPath).pop() ?? "/";
  const href =
    folderPath === "/" ? "/documentacion" : `/documentacion/${folderPath}`;
  const subtitle = supplier
    ? exists
      ? "Comercializadora"
      : "Comercializadora · sin documentos"
    : "Carpeta";
  // Las carpetas de comercializadora son fijas: ni mover, ni renombrar, ni borrar
  const canManage = !isComercial && !supplier && exists;

  const openDialog = (next: Exclude<FolderDialog, null>) => {
    setMenuOpen(false);
    setDialog(next);
  };

  const handleMove = async (
    destinationParent: string,
    onProgress: (progress: MoveProgress) => void
  ) => {
    const result = await moveDocumentLibraryFolder(
      {
        organizationId: userData.organization.id,
        folderPath,
        destinationParent,
      },
      onProgress
    );

    if (!result.success) {
      showCustomToast({
        title: "No se pudo mover la carpeta",
        message: describeMutationError(result, "Inténtalo de nuevo más tarde."),
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return false;
    }

    showCustomToast({
      title: "Carpeta movida",
      message: `La carpeta «${name}» se ha movido correctamente.`,
      iconColor: "var(--success-color)",
      iconSize: 24,
      icon: CheckCircle,
    });
    refreshDocumentacion();
    return true;
  };

  const content = (
    <>
      <h3 className="font-semibold text-gray-900 truncate group-hover/link:text-blue-600 transition-colors">
        {name}
      </h3>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </>
  );

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-gray-200 hover:border-gray-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Folder Icon */}
          <div className="flex-shrink-0">
            {supplier ? (
              <SupplierLogo supplier={supplier} />
            ) : (
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Folder className="h-6 w-6 text-blue-600" />
              </div>
            )}
          </div>

          {/* Folder Content */}
          <div className="flex-1 min-w-0">
            {onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(folderPath)}
                className="block w-full text-left group/link"
              >
                {content}
              </button>
            ) : (
              <Link href={href} className="block group/link">
                {content}
              </Link>
            )}
          </div>

          {/* Actions */}
          {canManage && (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Acciones de ${name}`}
                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-44 p-1 border-gray-200 shadow-lg"
                >
                  <Button
                    variant="ghost"
                    onClick={() => openDialog("move")}
                    className="w-full justify-start h-9 px-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <FolderInput className="h-4 w-4 mr-3" />
                    Mover a…
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => openDialog("rename")}
                    className="w-full justify-start h-9 px-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Pencil className="h-4 w-4 mr-3" />
                    Renombrar
                  </Button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <Button
                      variant="ghost"
                      onClick={() => openDialog("delete")}
                      className="w-full justify-start h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash className="h-4 w-4 mr-3" />
                      Eliminar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <MoveToFolderDialog
                open={dialog === "move"}
                onOpenChange={(open) => setDialog(open ? "move" : null)}
                title={`Mover «${name}»`}
                description="La carpeta se moverá con todo su contenido."
                currentFolder={parentPath}
                isDisabled={(node) =>
                  node.path === folderPath ||
                  node.path.startsWith(`${folderPath}/`)
                }
                onMove={handleMove}
              />
              <RenameFolderDialog
                open={dialog === "rename"}
                onOpenChange={(open) => setDialog(open ? "rename" : null)}
                folderPath={folderPath}
                organizationId={userData.organization.id}
              />
              <DeleteFolderConfirmationDialog
                open={dialog === "delete"}
                onOpenChange={(open) => setDialog(open ? "delete" : null)}
                folderPath={folderPath}
                organizationId={userData.organization.id}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
