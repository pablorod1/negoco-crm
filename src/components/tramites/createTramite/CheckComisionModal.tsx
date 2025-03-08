import { TramiteDB } from "@/lib/core/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tramite: TramiteDB;
  onSubmit: () => void;
}

export default function CheckComisionModal({
  isOpen,
  onClose,
  tramite,
  onSubmit,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" radius="sm">
      <ModalContent>
        <ModalHeader className="flex items-start gap-4">
          <AlertTriangle
            size={36}
            className="text-[var(--danger-color)] mt-1"
          />
          <div className="flex flex-col gap-1 h-full">
            <span className="text-[var(--danger-color)] text-xl">
              Comprobar comisiones
            </span>
            <span className="flex text-gray-500 text-base flex-1">
              Se recomienda verificar las comisiones antes de continuar.
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-2 ">
            <p className=" text-gray-500 font-semibold">
              Comisión: <span className="font-medium">{tramite.comision}</span>
            </p>
            <p className="font-semibold text-gray-500">
              Comisión {tramite.sales_name}:{" "}
              <span className="font-medium">
                {tramite.comision_sales_person}
              </span>
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button radius="sm" variant="light" color="danger" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            radius="sm"
            variant="solid"
            color="primary"
            onPress={onSubmit}
          >
            Entendido
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
