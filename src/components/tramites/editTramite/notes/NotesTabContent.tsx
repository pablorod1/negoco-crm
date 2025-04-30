import { ScrollArea } from "@/components/ui/scroll-area";
import CreateNoteDialog from "@/components/tramites/editTramite/notes/CreateNoteDialog";
import { useMemo } from "react";
import { Bell, CircleX, ClipboardList } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import DeleteTramiteNoteConfirmationModal from "./DeleteNoteConfirmationModal";
import { generateTramiteUpdatedNotification } from "@/lib/core/notifications.helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientDB } from "@/lib/core/types";

const postItColors = [
  "bg-yellow-200",
  "bg-green-200",
  "bg-blue-200",
  "bg-pink-200",
  "bg-purple-200",
];

interface NotesSectionProps {
  notes: string[];
  tramite_id: string;
  onDeletedNote: () => void;
  onAddNote: () => void;
  user_id: string;
  user_name: string;
  client: ClientDB;
}

export const TramiteNotesSection = ({
  notes,
  onDeletedNote,
  onAddNote,
  tramite_id,
  user_id,
  user_name,
  client,
}: NotesSectionProps) => {
  const handleUpdateNotes = async (note: string) => {
    try {
      const res = await fetch(`/api/tramites/add/notes`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: tramite_id,
          notes: notes,
          note: note,
        }),
      });
      const { success, error } = await res.json();

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
        icon: CircleX,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      const notification = generateTramiteUpdatedNotification({
        changes: {
          tramite: {
            notes,
          },
        },
        client: `${client.name} ${client.last_name}`,
        tramite_id,
        user_id,
      });

      const notificationRes = await fetch("/api/notifications/create", {
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
        message: `Se ha enviado una notificación a ${user_name}`,
        icon: Bell,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      onAddNote();
    } catch (error) {
      showCustomToast({
        title: "Error",
        message: error as string,
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };
  // Memoize the notes to prevent unnecessary re-renders
  const noteElements = useMemo(() => {
    return notes.map((note, index) => (
      <li
        key={index}
        className={`group relative ${
          postItColors[index % postItColors.length]
        } p-4 rounded-lg shadow-md transform w-full rotate-${
          Math.floor(Math.random() * 5) - 2
        } hover:rotate-0 transition-transform duration-200 ease-in-out`}
      >
        {note}
        <div className="absolute right-4 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
          <DeleteTramiteNoteConfirmationModal
            note={note}
            notes={notes}
            tramite_id={tramite_id}
            onDeleted={onDeletedNote}
          />
        </div>
      </li>
    ));
  }, [notes, onDeletedNote, tramite_id]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary-800">
          <ClipboardList className="h-5 w-5" />
          Notas
        </CardTitle>
        <CardDescription className="text-primary-400">
          {notes.length} nota
          {notes.length !== 1 ? "s" : ""} sobre este trámite
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notes.length > 0 ? (
            <ScrollArea className="w-full h-36">
              <ul className="space-y-2 mx-4 py-4">{noteElements}</ul>
            </ScrollArea>
          ) : (
            <p className="text-primary-400">No hay notas disponibles.</p>
          )}
          <CreateNoteDialog onCreateNote={handleUpdateNotes} />
        </div>
      </CardContent>
    </Card>
  );
};
