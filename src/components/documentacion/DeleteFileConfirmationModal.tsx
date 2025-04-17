"use client";
import { DocumentacionFile, User } from "@/lib/core/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import { useDocumentacion } from "@/lib/contexts/DocumentacionContext";
import { useState } from "react";
import LoadingStateModal from "../core/LoadingStateModal";

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
  onSubmit,
}: {
  files: DocumentacionFile[];
  userData: User;
  onSubmit?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { refreshDocumentacion } = useDocumentacion();
  const [loading, setLoading] = useState(false);

  const onClose = () => {
    setIsOpen(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documentacion/delete/file", {
        method: "POST",
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
      if (onSubmit) onSubmit();
      refreshDocumentacion();
      onClose();
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
        <Button variant="destructive" onClick={() => setIsOpen(true)}>
          <DeleteDocumentIcon />
          Eliminar Archivo
        </Button>
      </DialogTrigger>
      <DialogContent>
        {loading && (
          <LoadingStateModal
            title={getLoadingMessage().title}
            description={getLoadingMessage().description}
          />
        )}
        <DialogHeader>
          <div className="flex items-start gap-4">
            <AlertTriangle className="size-12 text-danger" />
            <div className="flex flex-col">
              <DialogTitle className="text-lg font-semibold text-danger">
                {files.length > 1
                  ? `¿Estás seguro de que deseas eliminar ${files.length} archivos?`
                  : "¿Estás seguro de que deseas eliminar el archivo?"}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm">
                {files.length > 1
                  ? "Se eliminarán los archivos de forma permanente."
                  : "Se eliminará el archivo de forma permanente."}
                Si alguna carpeta queda vacía, también se eliminará.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          {files.length > 1 ? (
            <div className="max-h-60 overflow-y-auto border rounded-md p-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Nombre
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Carpeta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr
                      key={file.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-3 py-2">{file.name}</td>
                      <td className="px-3 py-2">{file.folder_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Nombre:</h3>
                <p className="text-gray-600">{files[0]?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Carpeta:</h3>
                <p className="text-gray-600">{files[0]?.folder_name}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete}>
            {files.length > 1 ? "Eliminar Archivos" : "Eliminar Archivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
