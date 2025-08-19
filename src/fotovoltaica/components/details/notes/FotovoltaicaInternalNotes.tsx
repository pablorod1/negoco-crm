import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/core/components/ui/card";
import { FileText, CircleX, CircleCheck } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import CreateNoteDialog from "@/tramites/components/editTramite/notes/CreateNoteDialog";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  onSubmit: () => void;
}

export default function FotovoltaicaInternalNotes({
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
            internal_notes: fotovoltaica.internal_notes,
            is_internal: true, // Aseguramos que es una nota pública
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
            Notas Internas
          </span>
          <CreateNoteDialog onCreateNote={handleCreateNote} />
        </CardTitle>
        <CardDescription>Notas internas del equipo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fotovoltaica.internal_notes.length > 0 ? (
            fotovoltaica.internal_notes.map((note, index) => (
              <div
                key={index}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <p>{note}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground italic">
              No hay notas internas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
