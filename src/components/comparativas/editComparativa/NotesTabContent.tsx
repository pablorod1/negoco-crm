import { ScrollArea } from "@/components/ui/scroll-area";
import CreateNoteDialog from "@/components/tramites/editTramite/notes/CreateNoteDialog";
import DeleteNoteConfirmationModal from "@/components/comparativas/editComparativa/DeleteNoteConfirmationModal";
import { useMemo } from "react";

const postItColors = [
  "bg-yellow-200",
  "bg-green-200",
  "bg-blue-200",
  "bg-pink-200",
  "bg-purple-200",
];

interface NotesSectionProps {
  notes: string[];
  comparativaId: string;
  onDeletedNote: () => void;
  onAddNote: (note: string) => Promise<void>;
}

export const ComparativaNotesSection = ({
  notes,
  comparativaId,
  onDeletedNote,
  onAddNote,
}: NotesSectionProps) => {
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
          <DeleteNoteConfirmationModal
            note={note}
            notes={notes}
            comparativa_id={comparativaId}
            onDeleted={onDeletedNote}
          />
        </div>
      </li>
    ));
  }, [notes, comparativaId, onDeletedNote]);

  return (
    <div className="space-y-4">
      {notes.length > 0 ? (
        <ScrollArea className="w-full h-36">
          <ul className="space-y-2 mx-4 py-4">{noteElements}</ul>
        </ScrollArea>
      ) : (
        <p className="text-muted-foreground">No hay notas disponibles.</p>
      )}
      <CreateNoteDialog onCreateNote={onAddNote} />
    </div>
  );
};
