import LoadingStateModal from "@/components/core/LoadingStateModal";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import NotesBoard from "@/components/core/NotesBoard";
import { ComparativaDB, User } from "@/lib/core/types";
import { Button } from "@heroui/button";

interface Props {
  comparativa: ComparativaDB;
  setComparativa: React.Dispatch<React.SetStateAction<ComparativaDB>>;
  onCancel: () => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  userData: User;
}

export default function ThirdStepForm({
  comparativa,
  setComparativa,
  onCancel,
  onBack,
  onSubmit,
  loading,
  userData,
}: Props) {
  const handleAddNote = (note: string) => {
    setComparativa((prev) => ({
      ...prev,
      notes: [...prev.notes, note],
    }));
  };
  return (
    <FormWrapper>
      {loading && <LoadingStateModal userData={userData} />}
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
            Crear Comparativa
          </Button>
        </div>
      </div>
    </FormWrapper>
  );
}
