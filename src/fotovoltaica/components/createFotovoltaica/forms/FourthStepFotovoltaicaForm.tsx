import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import NotesBoard from "@/core/components/NotesBoard";
import FormWrapper from "@/tramites/components/createTramite/FormWrapper";
import { Label } from "@/core/components/ui/label";
import { User } from "@/core/types";
import { cn } from "@/core/utils";
import { FotovoltaicaDB } from "@/fotovoltaica/types";

interface Props {
  formData: FotovoltaicaDB;
  setFormData: React.Dispatch<React.SetStateAction<FotovoltaicaDB>>;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
  userData: User;
  loading: boolean;
}

export default function FourthStepFotovoltaicaForm({
  formData,
  setFormData,
  onSubmit,
  onBack,
  onCancel,
  userData,
  loading,
}: Props) {
  const isComercial = userData.role === "2";
  const handleCreateNote = (note: string) => {
    setFormData((prevData) => ({
      ...prevData,
      notes: [...(prevData.notes || []), note],
    }));
  };

  const handleCreateInternalNote = (note: string) => {
    setFormData((prevData) => ({
      ...prevData,
      internal_notes: [...(prevData.internal_notes || []), note],
    }));
  };
  return (
    <FormWrapper>
      {loading ? (
        <LoadingStateModal
          title="Enviando Solicitud..."
          description="Por favor, espera mientras se procesa tu solicitud."
        />
      ) : null}
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          isComercial ? "md:grid-cols-1" : "md:grid-cols-2"
        )}
      >
        <div>
          <Label>Notas</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Añade notas para ti o para el equipo de gestión.
          </p>
          <NotesBoard notes={formData.notes} onCreateNote={handleCreateNote} />
        </div>
        {!isComercial && (
          <div>
            <Label>Notas Internas</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Añade notas internas para el equipo de gestión.
            </p>
            <NotesBoard
              notes={formData.internal_notes}
              onCreateNote={handleCreateInternalNote}
            />
          </div>
        )}
      </div>
      <ButtonGroupComponent
        onSubmit={onSubmit}
        onCancel={onCancel}
        onBack={onBack}
        lastStep
        loading={loading}
      />
    </FormWrapper>
  );
}
