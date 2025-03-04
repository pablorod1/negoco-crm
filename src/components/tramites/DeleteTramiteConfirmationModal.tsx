import { TramiteVM, User } from "@/lib/core/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/react";
import { AlertTriangle, CheckCircle, CircleX, Trash } from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import EditTramiteDialog from "./EditTramiteDialog";
import { useTramites } from "@/contexts/TramitesContext";

export default function DeleteTramiteConfirmationModal({
  tramite,
  userData,
}: {
  tramite: TramiteVM;
  userData: User;
}) {
  const { isOpen, onClose, onOpen } = useDisclosure();
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
          client_id: tramite.client_id,
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
      refreshTramites();
      onClose();
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
      <Button
        variant="faded"
        onPress={onOpen}
        color="danger"
        className="border-0 bg-transparent w-full flex justify-start gap-4"
        startContent={<Trash className="h-4 w-4 text-red-500" />}
      >
        Eliminar
      </Button>
      <Modal size="2xl" isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex items-start gap-4">
            <AlertTriangle className="size-12 text-[var(--danger-color)]" />
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-[var(--danger-color)]">
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
            <EditTramiteDialog tramite_id={tramite.id} />
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
