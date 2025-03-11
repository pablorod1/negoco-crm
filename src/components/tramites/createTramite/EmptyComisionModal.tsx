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
}

export default function EmptyComisionModal({
  isOpen,
  onClose,
  tramite,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" radius="sm">
      <ModalContent>
        <ModalHeader className="flex items-start gap-4">
          <AlertTriangle
            size={36}
            className="text-[var(--danger-color)] mt-1"
          />
          <div className="flex flex-col h-full">
            <span className="text-[var(--danger-color)] text-xl">
              Comisiones sin asignar
            </span>
            <span className="flex text-gray-500 text-sm flex-1">
              Es necesario asignar comisiones antes de continuar.
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-2 ">
            <p className=" text-gray-700 font-bold">
              Comisión: <span className="font-medium">{tramite.comision}</span>
            </p>
            <p className="font-bold text-gray-700">
              Comisión {tramite.sales_name}:{" "}
              <span className="font-medium">
                {tramite.comision_sales_person}
              </span>
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button radius="sm" variant="solid" color="primary" onPress={onClose}>
            Entendido
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
