import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/core/components/ui/card";
import { FileText, CircleX, CircleCheck, Bell } from "lucide-react";
import { Notification } from "@/core/types";
import CreateNoteDialog from "@/tramites/components/editTramite/notes/CreateNoteDialog";
import { showCustomToast } from "@/core/components/CustomToast";
import { generateFotovoltaicaUpdatedNotification } from "@/core/utils/notifications.helpers";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  onSubmit: () => void;
}

export default function FotovoltaicaPublicNotes({
  fotovoltaica,
  onSubmit,
}: Props) {
  const handleCreateNote = async (note: string) => {
    try {
      const response = await fetch(
        `/api/v2/solar-installations/${fotovoltaica.id}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            note,
            notes: fotovoltaica.notes,
            is_internal: false, // Aseguramos que es una nota pública
          }),
        }
      );

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Nota añadida",
        message: "La nota se ha añadido correctamente.",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      const notification: Notification =
        generateFotovoltaicaUpdatedNotification({
          fotovoltaica_id: fotovoltaica.id,
          client: fotovoltaica.client,
          user_id: fotovoltaica.user_id,
          notes: true,
        });

      const notificationRes = await fetch("/api/v2/notifications", {
        method: "POST",
        body: JSON.stringify({ notification }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success: notificationSuccess, error: notificationError } =
        await notificationRes.json();

      if (!notificationSuccess) {
        showCustomToast({
          title: "Error creando notificación",
          message: notificationError,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Notificación enviada",
        message: `Se ha enviado una notificación a ${fotovoltaica.user.name}`,
        icon: Bell,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      onSubmit(); // Llamamos a onSubmit para refrescar los datos
    } catch (error) {
      console.error("Error al crear nota pública:", error);
      showCustomToast({
        title: "Error",
        message: "Ha ocurrido un error al crear la nota pública.",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notas Públicas
          </span>
          <CreateNoteDialog onCreateNote={handleCreateNote} />
        </CardTitle>
        <CardDescription>
          Notas visibles para el equipo comercial
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fotovoltaica.notes.length > 0 ? (
            fotovoltaica.notes.map((note, index) => (
              <div key={index} className="p-3 bg-muted rounded-lg">
                <p>{note}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground italic">
              No hay notas públicas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
