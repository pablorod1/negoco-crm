"use client";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { CheckCircle, CircleX, Coins } from "lucide-react";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import { ComparativaVM } from "@/lib/core/types";
import { useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { Spinner } from "@heroui/spinner";

interface Props {
  comparativa: ComparativaVM;
  onUpdate: () => void;
}

export default function UpdateComissionsModal({
  comparativa,
  onUpdate,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [loading, setLoading] = useState(false);
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
        if (changes) {
          const response = await fetch(`/api/comparativas/update/comissions`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: comparativa.id,
              comissions: changes,
            }),
          });

          const { success, error } = await response.json();

          if (!success) {
            showCustomToast({
              title: "Error al actualizar comisiones",
              message: error,
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: CircleX,
            });
            return;
          }

          showCustomToast({
            title: "Comisiones actualizadas",
            message: "Las comisiones se han actualizado correctamente",
            iconColor: "var(--success-color)",
            iconSize: 24,
            icon: CheckCircle,
          });
          onClose();
          onUpdate();
        } else {
          showCustomToast({
            title: "No hay cambios",
            message: "No se han realizado cambios en las comisiones",
            iconColor: "var(--warning-color)",
            iconSize: 24,
          });
          onClose();
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Button
        variant="light"
        color="primary"
        radius="sm"
        className="!bg-transparent"
        onPress={onOpen}
        startContent={<Coins size={16} />}
      >
        Actualizar comisiones
      </Button>
      <Modal
        isDismissable={false}
        hideCloseButton
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        radius="sm"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-2xl font-bold text-[var(--primary-color-800)]">
              Actualizar comisiones
            </h2>
          </ModalHeader>
          <ModalBody>
            {loading && (
              <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-15 ">
                <Spinner
                  size="lg"
                  variant="gradient"
                  label="Actualizando comisiones..."
                  color="primary"
                  className="text-lg"
                />
              </div>
            )}
            <ComissionsForm
              comparativa={comparativa}
              setFormDataComissions={setFormDataComissions}
              formDataComissions={formDataComissions}
            />
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
              Actualizar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
