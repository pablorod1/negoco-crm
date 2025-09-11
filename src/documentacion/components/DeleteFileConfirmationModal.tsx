"use client";
import { DocumentacionFile, User } from "@/core/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { useState } from "react";
import LoadingStateModal from "@/core/components/LoadingStateModal";

type IconProps = React.SVGProps<SVGSVGElement>;

export const DeleteDocumentIcon = (props: IconProps) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M21.07 5.23c-1.61-.16-3.22-.28-4.84-.37v-.01l-.22-1.3c-.15-.92-.37-2.3-2.71-2.3h-2.62c-2.33 0-2.55 1.32-2.71 2.29l-.21 1.28c-.93.06-1.86.12-2.79.21l-2.04.2c-.42.04-.72.41-.68.82.04.41.4.71.82.67l2.04-.2c5.24-.52 10.52-.32 15.82.21h.08c.38 0 .71-.29.75-.68a.766.766 0 0 0-.69-.82Z"
        fill="currentColor"
      />
      <path
        d="M19.23 8.14c-.24-.25-.57-.39-.91-.39H5.68c-.34 0-.68.14-.91.39-.23.25-.36.59-.34.94l.62 10.26c.11 1.52.25 3.42 3.74 3.42h6.42c3.49 0 3.63-1.89 3.74-3.42l.62-10.25c.02-.36-.11-.7-.34-.95Z"
        fill="currentColor"
        opacity={0.399}
      />
      <path
        clipRule="evenodd"
        d="M9.58 17a.75.75 0 0 1 .75-.75h3.33a.75.75 0 0 1 0 1.5h-3.33a.75.75 0 0 1-.75-.75ZM8.75 13a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
};

export default function DeleteFileConfirmationModal({
  files,
  userData,
}: {
  files: DocumentacionFile[];
  userData: User;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { refreshDocumentacion } = useDocumentacion();
  const [loading, setLoading] = useState(false);

  const onClose = () => {
    setIsOpen(false);
  };

  const onOpen = () => {
    setIsOpen(true);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v2/document-library", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: files.map((file) => ({
            folder_path: file.folder_name,
            file_name: file.name,
            file_id: file.id,
            organization_id: userData.organization.id,
          })),
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error eliminando archivos",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: files.length > 1 ? "Archivos eliminados" : "Archivo eliminado",
        message:
          files.length > 1
            ? "Los archivos han sido eliminados correctamente"
            : "El archivo ha sido eliminado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      onClose();
      refreshDocumentacion();
    } catch (error) {
      console.error("Error eliminando archivos:", error);
      showCustomToast({
        title: "Error eliminando archivos",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  };

  const getLoadingMessage = () => {
    if (files.length > 1) {
      return {
        title: "Eliminando archivos...",
        description: "Espere unos segundos mientras eliminamos los archivos.",
      };
    } else {
      return {
        title: "Eliminando archivo...",
        description: "Espere unos segundos mientras eliminamos el archivo.",
      };
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          onClick={onOpen}
          className="w-full justify-start h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <DeleteDocumentIcon className="h-4 w-4 mr-3" />
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg border-0 shadow-xl">
        {loading && (
          <LoadingStateModal
            title={getLoadingMessage().title}
            description={getLoadingMessage().description}
          />
        )}
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {files.length > 1
                  ? `Eliminar ${files.length} archivos`
                  : "Eliminar archivo"}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm leading-relaxed">
                {files.length > 1
                  ? "Esta acción eliminará permanentemente los archivos seleccionados."
                  : "Esta acción eliminará permanentemente el archivo seleccionado."}{" "}
                No se puede deshacer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {files.length > 1 ? (
            <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-2 px-3 bg-white rounded border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {file.folder_name || "Raíz"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Archivo:
                </span>
                <span className="text-sm text-gray-900">{files[0]?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Ubicación:
                </span>
                <span className="text-sm text-gray-900">
                  {files[0]?.folder_name || "Raíz"}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            {files.length > 1 ? "Eliminar archivos" : "Eliminar archivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
