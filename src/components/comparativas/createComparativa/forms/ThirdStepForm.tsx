import LoadingStateModal from "@/components/core/LoadingStateModal";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import NotesBoard from "@/components/tramites/editTramite/NotesBoard";
import { ComparativaDB } from "@/lib/core/types";
import { Button } from "@heroui/button";

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
      {loading && <LoadingStateModal />}
      <div className="w-full h-auto">
        <NotesBoard notes={comparativa.notes} onCreateNote={handleAddNote} />
      </div>
      <div className="w-full justify-between flex items-center mt-4">
        <Button variant="light" color="danger" onPress={onCancel} radius="sm">
          Cancelar
        </Button>
        <div className="flex items-center gap-4">
          <Button variant="light" color="default" onPress={onBack} radius="sm">
            Atrás
          </Button>
          <Button
            radius="sm"
            color="primary"
            variant="solid"
            onPress={onSubmit}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </FormWrapper>
  );
}
