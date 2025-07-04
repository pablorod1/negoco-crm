"use client";
import { Calendar, CircleX, ExternalLink, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";

import { showCustomToast } from "@/core/components/CustomToast";
import { Link } from "next-view-transitions";
import { Notification } from "@/core/types";
import { ClientDB, TramiteVM } from "@/tramites/types";
import { formatDate } from "@/core/utils/format";
import { NOW_DATE, RENOVATION_DATE } from "@/dashboard/constants";
import { useState } from "react";

interface Props {
  tramite: TramiteVM;
  client: ClientDB;
  onRenew: () => void;
}

export default function RenewTramiteConfirmationDialog({
  tramite,
  onRenew,
  client,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);

  const onClose = () => setIsOpen(false);
  const onOpen = () => setIsOpen(true);

  const handleRenewTramite = async () => {
    try {
      const res = await fetch(`/api/tramites/renew/${tramite.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
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
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button onClick={onOpen}>Renovar Trámite</Button>
        </DialogTrigger>
        <DialogContent className="py-4 w-full max-h-[90vh] overflow-auto">
          <DialogHeader
            className="text-xl font-semibold text-primary-800"
            aria-describedby={undefined}
          >
            <div className="flex items-center gap-2">
              <RefreshCcw className="text-primary" size={20} />
              <DialogTitle>Renovar Trámite</DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-5"></div>
          {/* Trámite information */}
          <div className="bg-primary-50 p-4 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-primary-700">
                Información del trámite
              </h3>
              <Link
                href={`/tramites/${tramite.id}`}
                target="_blank"
                className="text-primary hover:underline text-sm flex items-center gap-1"
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
                <p className="font-medium">
                  {client.name} {client.last_name}
                </p>
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
                  <div className="text-primary">?</div>
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
                  <div className="text-primary">?</div>
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

          <div className="flex items-start gap-2  rounded-md p-2">
            <Checkbox
              aria-label={`Notificar a ${tramite.user?.name || "el usuario"}`}
              checked={sendNotification}
              onCheckedChange={(checked) =>
                setSendNotification(checked as boolean)
              }
              className="mt-1 rounded-md"
            />

            <div className="flex flex-col">
              <h3 className="font-medium text-primary-700 ">
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
          <DialogFooter className="flex justify-between items-center gap-2 pt-2">
            <Button variant="destructive" onClick={onClose} className="px-4">
              Cancelar
            </Button>
            <Button
              onClick={handleRenewTramite}
              className="px-4 flex items-center gap-2"
            >
              <RefreshCcw size={16} />
              Confirmar renovación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
