import LoadingStateModal from "@/core/components/LoadingStateModal";
import FormWrapper from "@/tramites/components/createTramite/FormWrapper";
import NotesBoard from "@/core/components/NotesBoard";
import { Button } from "@/core/components/ui/button";
import { ComparativaDB } from "@/comparativas/types";

interface Props {
  comparativa: ComparativaDB;
  setComparativa: React.Dispatch<React.SetStateAction<ComparativaDB>>;
  onCancel: () => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function ThirdStepForm({
  comparativa,
  setComparativa,
  onCancel,
  onBack,
  onSubmit,
  loading,
}: Props) {
  const handleAddNote = (note: string) => {
    setComparativa((prev) => ({
      ...prev,
      notes: [...prev.notes, note],
    }));
  };
  return (
    <FormWrapper>
      {loading && (
        <LoadingStateModal
          title="Creando comparativa..."
          description="Espere unos segundos mientras creamos la comparativa."
        />
      )}
      <div className="w-full h-auto">
        <NotesBoard notes={comparativa.notes} onCreateNote={handleAddNote} />
      </div>
      <div className="w-full justify-between flex items-center mt-4">
        <Button variant="destructive" onClick={onCancel}>
          Cancelar
        </Button>
        <div className="flex items-center gap-4">
          <Button variant="destructive" onClick={onBack}>
            Atrás
          </Button>
          <Button onClick={onSubmit}>Crear Comparativa</Button>
        </div>
      </div>
    </FormWrapper>
  );
}
