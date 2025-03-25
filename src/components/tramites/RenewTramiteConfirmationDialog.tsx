"use client";
import { Calendar, CircleX, ExternalLink, RefreshCcw } from "lucide-react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";

import { showCustomToast } from "../core/CustomToast";
import Link from "next/link";
import { Notification, TramiteVM } from "@/lib/core/types";
import { formatDate } from "@/lib/core/format";
import { NOW_DATE, RENOVATION_DATE } from "@/lib/core/const";
import { useState } from "react";
import { cn } from "@/lib/core/utils";

interface Props {
  tramite: TramiteVM;
  isOpen: boolean;
  onClose: () => void;
  onRenew: () => void;
}

export default function RenewTramiteConfirmationDialog({
  tramite,
  isOpen,
  onClose,
  onRenew,
}: Props) {
  const [sendNotification, setSendNotification] = useState(true);
  const handleRenewTramite = async () => {
    try {
      const res = await fetch(`/api/tramites/renew`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: tramite.id }),
      });

      const { success, error } = await res.json();

      if (!success && error) {
        showCustomToast({
          title: "Error al renovar el trámite",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
      }

      const notification: Notification = {
        id: tramite.id,
        title: "Trámite renovado",
        message: `El trámite ${tramite.id} ha sido renovado.`,
        created_at: new Date().toISOString(),
        context: "Tramites",
        link: tramite.id,
        priority: 3,
        user_id: tramite.user_id,
      };

      if (sendNotification) {
        const notificationRes = await fetch(`/api/notifications/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notification }),
        });

        const { success: notificationSuccess, error: notificationError } =
          await notificationRes.json();

        if (!notificationSuccess) {
          showCustomToast({
            title: "Error al enviar notificación",
            message: notificationError,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
        }
      }

      showCustomToast({
        title: "Trámite renovado",
        message: `El trámite ha sido renovado correctamente. ${
          sendNotification ? `Se ha notificado a ${tramite.user.name}` : ""
        }`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: RefreshCcw,
      });
      onRenew();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al renovar el trámite",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error(error);
    }
  };

  return (
    <>
      <Modal
        size="xl"
        radius="sm"
        inert={!isOpen}
        hideCloseButton
        isDismissable={false}
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          wrapper: "overflow-hidden",
        }}
      >
        <ModalContent className="py-4 w-full max-h-[90vh] overflow-auto">
          <ModalHeader className="text-xl font-semibold text-[var(--primary-color-800)]">
            <div className="flex items-center gap-2">
              <RefreshCcw className="text-[var(--primary-color)]" size={20} />
              Renovar Trámite
            </div>
          </ModalHeader>
          <ModalBody className="flex flex-col gap-5">
            {/* Trámite information */}
            <div className="bg-[var(--primary-color-50)] p-4 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-[var(--primary-color-700)]">
                  Información del trámite
                </h3>
                <Link
                  href={`/tramites/${tramite.id}`}
                  target="_blank"
                  className="text-[var(--primary-color)] hover:underline text-sm flex items-center gap-1"
                >
                  Ver detalles completos
                  <ExternalLink size={16} />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-gray-500">ID del trámite</p>
                  <p className="font-medium">{tramite.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-medium">{tramite.client_id}</p>
                </div>
              </div>
            </div>

            {/* Date changes */}
            <div className="border border-[var(--warning-color-200)] bg-[var(--warning-color-50)] p-4 rounded-md">
              <h3 className="font-medium text-[var(--warning-color-700)] mb-3 flex items-center gap-2">
                <Calendar size={18} />
                Cambios en fechas
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Fecha de activación</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Actual</p>
                      <p className="text-sm">
                        {formatDate(tramite.activation_date)}
                      </p>
                    </div>
                    <div className="text-[var(--primary-color)]">→</div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Nueva</p>
                      <p className="text-sm font-medium">
                        {formatDate(NOW_DATE.toString())}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Fecha de renovación</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Actual</p>
                      <p className="text-sm">
                        {formatDate(tramite.renovation_date)}
                      </p>
                    </div>
                    <div className="text-[var(--primary-color)]">→</div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Nueva</p>
                      <p className="text-sm font-medium">
                        {formatDate(RENOVATION_DATE.toString())}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Checkbox
              aria-label={`Notificar a ${tramite.user?.name || "el usuario"}`}
              classNames={{
                base: cn(
                  "inline-flex w-full",
                  "hover:bg-primary-50 items-start justify-start",
                  "cursor-pointer rounded-lg gap-2 px-4 py-2 ",
                  "data-[selected=true]:bg-primary-50"
                ),
                label: "w-full",
                icon: "w-3 h-3",
              }}
              isSelected={sendNotification}
              onValueChange={setSendNotification}
            >
              <div className="bg-[var(--success-color-50)] rounded-md flex items-start gap-3">
                <div>
                  <h3 className="font-medium text-[var(--success-color-700)] mb-1">
                    Notificación al usuario
                  </h3>
                  <p className="text-sm text-gray-600">
                    Se enviará una notificación a{" "}
                    <span className="font-medium">
                      {tramite.user?.name || "el usuario"}
                    </span>{" "}
                    informando sobre la renovación del trámite.
                  </p>
                </div>
              </div>
            </Checkbox>
          </ModalBody>
          <ModalFooter className="flex justify-between items-center gap-2 pt-2">
            <Button
              variant="light"
              color="danger"
              onPress={onClose}
              radius="sm"
              className="px-4"
            >
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={handleRenewTramite}
              radius="sm"
              className="px-4 flex items-center gap-2"
            >
              <RefreshCcw size={16} />
              Confirmar renovación
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
