"use client";
import { ComparativaStatus, ComparativaVM, User } from "@/lib/core/types";

import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import { useComparativas } from "@/lib/contexts/ComparativasContext";
import { formatDate } from "@/lib/core/format";
import { useState } from "react";
import LoadingStateModal from "../core/LoadingStateModal";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

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

export default function DeleteComparativaConfirmationModal({
  comparativa,
  userData,
}: {
  comparativa: ComparativaVM;
  userData: User;
}) {
  const { refreshComparativas } = useComparativas();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => setIsOpen(false);

  const organization_id = userData.organization.id;

  const handleDelete = async () => {
    setLoading(true);
    if (!userData) {
      console.error("Error al obtener el usuario");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/comparativas/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: comparativa.id,
          organization_id,
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        console.error("Error al eliminar la comparativa", error);
        return;
      }

      showCustomToast({
        title: "Comparativa eliminada",
        message: "La comparativa se ha eliminado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });

      try {
        await refreshComparativas();
        onClose();
      } catch (error) {
        console.error("Error al refrescar las comparativas:", error);
        showCustomToast({
          title: "Error al refrescar las comparativas",
          message: "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        onClose();
      }
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al eliminar la comparativa",
        message: "Ha ocurrido un error al eliminar la comparativa",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button
            className="w-full text-danger gap-2 inline-flex justify-start items-center"
            variant="link"
            onClick={() => setIsOpen(true)}
          >
            <DeleteDocumentIcon />
            Eliminar comparativa
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader className="flex items-start gap-4">
            <AlertTriangle className="size-12 text-danger" />
            <div className="flex flex-col">
              <DialogTitle className="text-lg font-semibold text-danger">
                ¿Estás seguro de que deseas eliminar la comparativa{" "}
                {comparativa.id}?
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm">
                Se eliminará la comparativa y todos los datos asociados a él de
                forma permanente.
              </DialogDescription>
            </div>
          </DialogHeader>
          {loading && <LoadingStateModal userData={userData} />}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-md font-medium mb-3">
              Detalles de la comparativa:
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Cliente</p>
                <p className="font-medium">{comparativa.client}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Servicio</p>
                <p className="font-medium">{comparativa.service}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha de creación</p>
                <p className="font-medium">
                  {formatDate(comparativa.creation_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>

                {getStatusBadge(comparativa.status as ComparativaStatus)}
              </div>
              <div>
                <p className="text-sm text-gray-500">Creado por</p>
                <p className="font-medium">
                  {comparativa.user?.name || "No disponible"}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="primaryOutline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar comparativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
