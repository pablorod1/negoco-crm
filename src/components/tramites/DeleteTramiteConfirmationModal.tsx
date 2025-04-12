"use client";
import { TramiteRow, User } from "@/lib/core/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import {
  AlertTriangle,
  CheckCircle,
  CircleX,
  ExternalLink,
} from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import { useTramites } from "@/lib/contexts/TramitesContext";
import Link from "next/link";

export default function DeleteTramiteConfirmationModal({
  tramite,
  userData,
  isOpen,
  onClose,
}: {
  tramite: TramiteRow;
  userData: User;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refreshTramites } = useTramites();

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/tramites/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tramite_id: tramite.id,
          organization_id: userData.organization.id,
        }),
      });

      const { success, error } = await res.json();
      if (!success && error) {
        showCustomToast({
          title: "Error",
          message: error,
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
      }

      showCustomToast({
        title: "Trámite eliminado",
        message: `El trámite ${tramite.id} ha sido eliminado correctamente`,
        icon: CheckCircle,
        iconSize: 24,
        iconColor: "var(--success-color)",
      });
      try {
        refreshTramites();
        onClose();
      } catch (error) {
        console.error("Error al refrescar los trámites:", error);
        showCustomToast({
          title: "Error",
          message: "Inténtalo de nuevo más tarde",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        onClose();
      }
    } catch (error) {
      showCustomToast({
        title: "Error",
        message: "Error al eliminar el trámite",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      console.error("Error al eliminar trámite:", error);
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
                ¿Estás seguro de que deseas eliminar el trámite {tramite.id}?
              </h2>
              <p className="text-gray-600 text-sm">
                Se eliminará el trámite y todos los datos asociados a él de
                forma permanente.
              </p>
            </div>
          </ModalHeader>
          <ModalBody className="flex justify-end gap-4 mt-4">
            <span>
              Comprueba el trámite antes de eliminarlo. Esta acción no se puede
              deshacer.
            </span>
            <Link
              href={`/tramites/${tramite.id}`}
              target="_blank"
              passHref
              className="flex items-center gap-2 text-primary-500 hover:underline hover:text-primary-700"
            >
              <span>Visualizar trámite</span>
              <ExternalLink size={16} />
            </Link>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" color="default" onPress={onClose}>
              Cancelar
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Eliminar trámite
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
