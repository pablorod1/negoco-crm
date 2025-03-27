"use client";
import { ComparativaVM, User } from "@/lib/core/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import { useComparativas } from "@/lib/contexts/ComparativasContext";
import { formatDate } from "@/lib/core/format";
import { useState } from "react";
import LoadingStateModal from "../core/LoadingStateModal";

export default function DeleteComparativaConfirmationModal({
  comparativa,
  userData,
  isOpen,
  onClose,
}: {
  comparativa: ComparativaVM;
  userData: User;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refreshComparativas } = useComparativas();
  const [loading, setLoading] = useState(false);

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
      refreshComparativas();
      onClose();
    }
  };
  return (
    <>
      <Modal size="2xl" isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex items-start gap-4">
            <AlertTriangle className="size-12 text-danger" />
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-danger">
                ¿Estás seguro de que deseas eliminar la comparativa{" "}
                {comparativa.id}?
              </h2>
              <p className="text-gray-600 text-sm">
                Se eliminará la comparativa y todos los datos asociados a él de
                forma permanente.
              </p>
            </div>
          </ModalHeader>
          <ModalBody className="py-4">
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
                  <p className="font-medium">{comparativa.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Creado por</p>
                  <p className="font-medium">
                    {comparativa.user?.name || "No disponible"}
                  </p>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" color="default" onPress={onClose}>
              Cancelar
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Eliminar comparativa
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
