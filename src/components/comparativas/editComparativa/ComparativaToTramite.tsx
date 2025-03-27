import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { ComparativaVM } from "@/lib/core/types";
import { useState } from "react";
import AddTramiteDialog from "@/components/tramites/createTramite/AddTramiteDialog";

interface Props {
  comparativa: ComparativaVM;
  onComparativaUpdated: () => void;
}

export default function ComparativaToTramite({
  comparativa,
  onComparativaUpdated,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [plan, setPlan] = useState<"fijo" | "indexado">("fijo");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPlan(e.target.value as "fijo" | "indexado");
  };

  const handleClose = () => {
    onComparativaUpdated();
    onClose();
  };
  return (
    <>
      <Button onPress={onOpen} variant="bordered">
        Tramitar Comparativa
      </Button>
      <Modal
        isDismissable={false}
        hideCloseButton
        inert={!isOpen}
        size="3xl"
        isOpen={isOpen}
        onClose={onClose}
        radius="sm"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-primary-800">
                Comparativa {comparativa.id} · {comparativa.client}
              </h3>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="flex justify-center items-center max-w-sm mx-auto">
                <Select
                  isRequired
                  label="Plan"
                  size="lg"
                  radius="sm"
                  color="primary"
                  variant="bordered"
                  selectedKeys={[plan]}
                  onChange={handleChange}
                >
                  <SelectItem key="fijo">Fijo</SelectItem>
                  <SelectItem key="completed">Indexado</SelectItem>
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              radius="sm"
              color="danger"
              onPress={onClose}
              variant="light"
            >
              Cancelar
            </Button>
            <AddTramiteDialog
              comparativa={comparativa}
              plan={plan}
              onComparativaUpdated={handleClose}
            />
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
