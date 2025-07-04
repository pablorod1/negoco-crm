import { ScrollArea } from "@/core/components/ui/scroll-area";
import CreateNoteDialog from "@/tramites/components/editTramite/notes/CreateNoteDialog";
import { useMemo } from "react";
import { Bell, CircleCheck, CircleX, ClipboardList } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import DeleteTramiteNoteConfirmationModal from "./DeleteNoteConfirmationModal";
import { generateTramiteUpdatedNotification } from "@/core/utils/notifications.helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { ClientDB } from "@/tramites/types";
import { User } from "@/core/types";
import { cn } from "@/core/utils";

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
  userData: User;
  client: ClientDB;
  internalNotes: string[];
}

export const TramiteNotesSection = ({
  notes,
  onDeletedNote,
  onAddNote,
  tramite_id,
  userData,
  client,
  internalNotes,
}: NotesSectionProps) => {
  const isComercial = userData.role === "2";
  const handleUpdateNotes = async (
    note: string,
    isInternal: boolean = false
  ) => {
    try {
      const res = await fetch(`/api/tramites/add/${tramite_id}/notes`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes,
          internal_notes: internalNotes,
          note: note,
          is_internal: isInternal,
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
        message: `La ${isInternal ? "nota interna" : "nota"} se ha añadido correctamente.`,
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      if (!isInternal) {
        const notification = generateTramiteUpdatedNotification({
          changes: {
            tramite: {
              notes,
            },
          },
          client: `${client.name} ${client.last_name}`,
          tramite_id,
          user_id: userData.id,
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
          message: `Se ha enviado una notificación a ${userData.name}`,
          icon: Bell,
          iconColor: "var(--success-color)",
          iconSize: 24,
        });
      }
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

  const handleRegularNote = (note: string) => handleUpdateNotes(note, false);
  const handleInternalNote = (note: string) => handleUpdateNotes(note, true);

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

  const internalNoteElements = useMemo(() => {
    if (!internalNotes) return;
    return internalNotes.map((note, index) => (
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
            internal_notes={internalNotes}
            tramite_id={tramite_id}
            onDeleted={onDeletedNote}
          />
        </div>
      </li>
    ));
  }, [internalNotes, onDeletedNote, tramite_id]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        "mb-6",
        !isComercial ? "lg:grid-cols-2" : ""
      )}
    >
      <Card>
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
            <CreateNoteDialog onCreateNote={handleRegularNote} />
          </div>
        </CardContent>
      </Card>
      {!isComercial && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary-800">
              <ClipboardList className="h-5 w-5" />
              Notas Internas
            </CardTitle>
            <CardDescription className="text-primary-400">
              {internalNotes ? internalNotes.length : 0} nota
              {internalNotes
                ? internalNotes.length !== 1
                  ? "s"
                  : ""
                : "s"}{" "}
              sobre este trámite
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {internalNotes && internalNotes.length > 0 ? (
                <ScrollArea className="w-full h-36">
                  <ul className="space-y-2 mx-4 py-4">
                    {internalNoteElements}
                  </ul>
                </ScrollArea>
              ) : (
                <p className="text-primary-400">No hay notas disponibles.</p>
              )}
              <CreateNoteDialog onCreateNote={handleInternalNote} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
