import FormWrapper from "@/tramites/components/createTramite/FormWrapper";
import FormTicketsSection from "@/core/components/FormTicketsSection";
import { Button } from "@/core/components/ui/button";
import { ComparativaDB } from "@/comparativas/types";
import { User } from "@/core/types";
import LoadingStateModal from "@/core/components/LoadingStateModal";

interface Props {
  comparativa: ComparativaDB;
  userData: User;
  onCancel: () => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function ThirdStepForm({
  comparativa,
  userData,
  onCancel,
  onBack,
  onSubmit,
  loading,
}: Props) {
  return (
    <FormWrapper>
      {loading ? (
        <LoadingStateModal
          title="Creando Comparativa..."
          description="Esto puede tardar unos segundos, por favor no cierres esta ventana."
        />
      ) : null}
      {/* Tickets section with improved spacing */}
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-900">
              Observaciones adicionales
            </h3>
            <p className="text-xs text-gray-500">
              Añade cualquier comentario o especificación relevante
            </p>
          </div>
          <FormTicketsSection
            context="comparativa"
            refId={comparativa.id}
            assignedTo={comparativa.user_id}
            userData={userData}
            title=""
            subtitle=""
          />
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onCancel} className="px-4">
            Cancelar
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack} className="px-4">
              Atrás
            </Button>
            <Button onClick={onSubmit} disabled={loading} className="px-4">
              {loading ? "Creando..." : "Crear Comparativa"}
            </Button>
          </div>
        </div>
      </div>
    </FormWrapper>
  );
}
