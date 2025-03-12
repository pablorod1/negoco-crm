import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { ComparativaStatus, ComparativaVM } from "@/lib/core/types";
import { Select, SelectItem } from "@heroui/select";
import { useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleCheck, CircleX } from "lucide-react";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import { Chip } from "@heroui/chip";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import { Divider } from "@heroui/react";

const STATUS_BADGES = {
  pending: (
    <Chip variant="flat" color="warning">
      Pendiente de Estudio
    </Chip>
  ),
  completed: (
    <Chip variant="flat" color="success">
      Estudio Realizado
    </Chip>
  ),
  processed: (
    <Chip
      variant="flat"
      color="primary"
      className="bg-[var(--primary-color-100)]"
    >
      Comparativa Tramitada
    </Chip>
  ),
  rejected: (
    <Chip variant="flat" color="danger">
      Rechazada
    </Chip>
  ),
  default: <Chip variant="flat">Desconocido</Chip>,
};

interface Props {
  comparativa: ComparativaVM;
  onUpdate: () => void;
}

export default function UpdateComparativaStatusModal({
  comparativa,
  onUpdate,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [newStatus, setNewStatus] = useState<ComparativaStatus>(
    comparativa.status
  );
  const [formDataComissions, setFormDataComissions] = useState<
    Partial<ComissionFormValues>
  >(
    comparativa.plan.includes("fijo") && comparativa.plan.includes("indexado")
      ? {
          comision_fijo: comparativa.comision.fijo,
          comision_indexado: comparativa.comision.indexado,
          comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
          comision_sales_person_indexado:
            comparativa.comision_sales_person.indexado,
        }
      : comparativa.plan.includes("fijo")
      ? {
          comision_fijo: comparativa.comision.fijo,
          comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
        }
      : {
          comision_indexado: comparativa.comision.indexado,
          comision_sales_person_indexado:
            comparativa.comision_sales_person.indexado,
        }
  );
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    onOpen();
    setNewStatus(comparativa.status);
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewStatus(e.target.value as ComparativaStatus);
  };

  const checkEmptyComissions = () => {
    return Object.values(formDataComissions).some((value) => !value);
  };

  const checkComissionsChanged = () => {
    const changes = {
      comision_fijo:
        formDataComissions.comision_fijo !== comparativa.comision.fijo
          ? formDataComissions.comision_fijo
          : undefined,
      comision_indexado:
        formDataComissions.comision_indexado !== comparativa.comision.indexado
          ? formDataComissions.comision_indexado
          : undefined,
      comision_sales_person_fijo:
        formDataComissions.comision_sales_person_fijo !==
        comparativa.comision_sales_person.fijo
          ? formDataComissions.comision_sales_person_fijo
          : undefined,
      comision_sales_person_indexado:
        formDataComissions.comision_sales_person_indexado !==
        comparativa.comision_sales_person.indexado
          ? formDataComissions.comision_sales_person_indexado
          : undefined,
    };

    return Object.values(changes).some((value) => value !== undefined)
      ? changes
      : null;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (checkEmptyComissions()) {
        showCustomToast({
          title: "Error al actualizar las comisiones",
          message: "Por favor, rellena todos los campos",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      } else {
        const changes = checkComissionsChanged();

        const res = await fetch("/api/comparativas/update/status", {
          method: "PATCH",
          body: JSON.stringify({
            id: comparativa.id,
            status: newStatus,
            comissions: changes ? changes : undefined,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        const { success, error } = await res.json();

        if (!success) {
          showCustomToast({
            title: "Error al actualizar estado",
            message: error,
            icon: CircleX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        showCustomToast({
          title: "Estado Actualizado",
          message:
            "El estado de la comparativa ha sido actualizado correctamente",
          icon: CircleCheck,
          iconColor: "var(--success-color)",
          iconSize: 24,
        });
      }
    } catch (error) {
      showCustomToast({
        title: "Error al actualizar estado",
        message: "Ocurrió un error al actualizar el estado de la comparativa",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      console.error("Error updating comparativa status:", error);
    } finally {
      setLoading(false);
      onUpdate();
      onClose();
    }
  };

  const getStatusBadge = (status: ComparativaStatus) => {
    return STATUS_BADGES[status] || STATUS_BADGES.default;
  };

  return (
    <>
      <Button onPress={handleOpen} variant="bordered">
        Actualizar
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
              <h3 className="text-xl font-semibold text-[var(--primary-color-800)]">
                Comparativa {comparativa.id} · {comparativa.client}
              </h3>

              {getStatusBadge(comparativa.status)}
            </div>
          </ModalHeader>
          <ModalBody>
            {loading && <LoadingStateModal />}
            <div className="space-y-4">
              <div className="flex justify-center items-center max-w-sm mx-auto">
                <Select
                  label="Estado de la Comparativa"
                  size="lg"
                  radius="sm"
                  color="primary"
                  variant="bordered"
                  selectedKeys={[newStatus]}
                  onChange={handleChange}
                >
                  <SelectItem key="pending">Pendiente de Estudio</SelectItem>
                  <SelectItem key="completed">Estudio Realizado</SelectItem>
                  <SelectItem key="processed">Comparativa Tramitada</SelectItem>
                  <SelectItem key="rejected">Comparativa Rechazada</SelectItem>
                </Select>
              </div>
              {newStatus === "completed" && (
                <>
                  <Divider />
                  <div className="flex flex-col gap-2">
                    <ComissionsForm
                      comparativa={comparativa}
                      formDataComissions={formDataComissions}
                      setFormDataComissions={setFormDataComissions}
                    />
                    <div className="flex items-start gap-1">
                      <small className="text-gray-500">*</small>
                      <div className=" flex flex-col gap-1">
                        <p className="text-sm text-gray-500">
                          Comprueba las comisiones de la comparativa antes de
                          actualizar el estado.
                        </p>
                        <p className="text-sm text-gray-500">
                          Para completar el estudio de la comparativa, es
                          necesario que las comisiones estén asignadas.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
            <Button
              variant="solid"
              color="primary"
              radius="sm"
              onPress={handleSubmit}
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
