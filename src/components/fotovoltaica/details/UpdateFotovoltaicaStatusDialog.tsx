import { FotovoltaicaVM, Notification, User } from "@/lib/core/types";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SelectComponent } from "@/components/tramites/createTramite/InputComponent";
import { FOTOVOLTAICA_STATUS_TYPES } from "@/lib/core/const";
import { showCustomToast } from "@/components/core/CustomToast";
import { CheckCircle, CircleX } from "lucide-react";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import { generateFotovoltaicaUpdatedNotification } from "@/lib/core/notifications.helpers";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  onSubmit: () => void;
  userData: User;
}

export default function UpdateFotovoltaicaStatusDialog({
  fotovoltaica,
  onSubmit,
  userData,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    status: string;
  }>({
    status: fotovoltaica.status,
  });

  const onClose = () => setIsOpen(false);
  const onOpen = () => setIsOpen(true);

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      status: value,
    }));
  };

  const textValue = FOTOVOLTAICA_STATUS_TYPES.find(
    (item) => item.value === formData.status
  )?.label;

  const checkStatusChanged = () => {
    return formData.status !== fotovoltaica.status;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/fotovoltaica/update/${fotovoltaica.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changes: {
              status: formData.status,
            },
            user_id: userData.id,
          }),
        }
      );

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al actualizar el estado",
          message:
            error || "No se pudo actualizar el estado de la fotovoltaica.",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
      }

      const notification: Notification =
        generateFotovoltaicaUpdatedNotification({
          fotovoltaica_id: fotovoltaica.id,
          client: fotovoltaica.client,
          user_id: fotovoltaica.user_id,
          status: checkStatusChanged() ? formData.status : undefined,
        });

      const notificationResponse = await fetch(`/api/notifications/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification }),
      });

      const { success: notificationSuccess, error: notificationError } =
        await notificationResponse.json();

      if (!notificationSuccess && notificationError) {
        showCustomToast({
          title: "Error al notificar cambios",
          message: notificationError,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      if (checkStatusChanged()) {
        const emailRes = await fetch(
          `/api/send-email/fotovoltaica-status-updated`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_to: {
                email: fotovoltaica.user.email,
                name: fotovoltaica.user.name,
                org_logo: userData.organization.logo,
              },
              fotovoltaica_id: fotovoltaica.id,
              client: fotovoltaica.client,
              status: {
                old: fotovoltaica.status,
                new: formData.status,
              },
            }),
          }
        );

        const { success: emailSuccess, error: emailError } =
          await emailRes.json();

        if (!emailSuccess) {
          showCustomToast({
            title: "Error al enviar el email",
            message:
              emailError || "No se pudo enviar el correo de notificación.",
            icon: CircleX,
            iconSize: 24,
            iconColor: "var(--danger-color)",
          });
          return;
        }
      }

      showCustomToast({
        title: "Estado actualizado",
        message: "El estado de la solicitud se ha actualizado correctamente.",
        icon: CheckCircle,
        iconSize: 24,
        iconColor: "var(--success-color)",
      });
      onSubmit();
      onClose();
    } catch (error) {
      console.error("Error updating fotovoltaica status:", error);
      showCustomToast({
        title: "Error al actualizar el estado",
        message:
          "Ocurrió un error al intentar actualizar el estado de la fotovoltaica.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          Actualizar Estado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl space-y-6">
        {loading && (
          <LoadingStateModal
            title="Actualizando Estado"
            description="Por favor, espera mientras se actualiza el estado de la solicitud."
          />
        )}
        <DialogHeader>
          <DialogTitle className="text-primary-800">
            Actualizar Estado de Fotovoltaica
          </DialogTitle>
          <DialogDescription>
            Selecciona el nuevo estado para la fotovoltaica.
          </DialogDescription>
        </DialogHeader>
        <SelectComponent
          label="Estado"
          name="status"
          selectedKey={formData.status}
          textValue={textValue || ""}
          onChange={handleSelectChange}
          items={FOTOVOLTAICA_STATUS_TYPES}
          isRequired
        />
        <DialogFooter>
          <ButtonGroupComponent
            onSubmit={handleSubmit}
            onCancel={onClose}
            lastStep
            loading={loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
