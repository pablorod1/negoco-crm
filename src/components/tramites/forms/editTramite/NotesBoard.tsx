import type React from "react";
import { EditFormWrapper } from "./EditFormWrapper";
import CreateNoteDialog from "./CreateNoteDialog";

interface NotesBoardProps {
  notes: string[];
  onCreateNote: (note: string) => void;
}

const NotesBoard: React.FC<NotesBoardProps> = ({ notes, onCreateNote }) => {
  const postItColors = [
    "bg-yellow-200",
    "bg-green-200",
    "bg-blue-200",
    "bg-pink-200",
    "bg-purple-200",
  ];

  return (
    <EditFormWrapper title="Notas">
      <div className="bg-gray-50 p-6 rounded-lg shadow-inner min-h-[300px] relative overflow-hidden">
        {/* Líneas de la pizarra */}
        <div className="absolute inset-0 grid grid-cols-[repeat(10,1fr)] opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="border-l border-[var(--primary-color-800)]"
            ></div>
          ))}
        </div>
        <div className="absolute inset-0 grid grid-rows-[repeat(10,1fr)] opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="border-t border-[var(--primary-color-800)]"
            ></div>
          ))}
        </div>

        {/* Post-its */}
        <div className="flex flex-wrap items-stretch gap-4 relative z-10">
          <CreateNoteDialog onCreateNote={onCreateNote} />
          {notes.map((note, index) => (
            <div
              key={index}
              className={`${
                postItColors[index % postItColors.length]
              } p-4 rounded-lg shadow-md transform w-fit max-w-44 rotate-${
                Math.floor(Math.random() * 5) - 2
              } hover:rotate-0 transition-transform duration-200 ease-in-out`}
            >
              <p className="text-gray-800 font-handwriting text-lg">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </EditFormWrapper>
  );
};

export default NotesBoard;
